import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { BD } from "../db/cliente";
import { cierresCaja, comprobantes, pedidoItems, pedidos } from "../db/schema";
import { calcularTotal, diaBogota, ErrorNegocio } from "../domain/reglas";

/**
 * Cobra un pedido entregado: emite un comprobante interno con número consecutivo y
 * marca el pedido como PAGADO, todo en una sola transacción.
 * El comprobante NO es una factura electrónica (ver docs/alcance.md).
 */
export async function pagarPedido(bd: BD, pedidoId: number, emitidoPorId: number) {
  return bd.transaction(
    async (tx) => {
      const pedido = await tx.query.pedidos.findFirst({ where: eq(pedidos.id, pedidoId), with: { items: true } });
      if (!pedido) throw new ErrorNegocio("El pedido no existe.");
      if (pedido.estado === "PAGADO") throw new ErrorNegocio("El pedido ya fue pagado.");
      if (pedido.estado !== "ENTREGADO") throw new ErrorNegocio("Solo se cobran pedidos entregados.");

      const [{ ultimo }] = await tx
        .select({ ultimo: sql<number>`coalesce(max(${comprobantes.numero}), 0)` })
        .from(comprobantes);
      const [comprobante] = await tx
        .insert(comprobantes)
        .values({ numero: ultimo + 1, pedidoId, total: calcularTotal(pedido.items), emitidoPorId })
        .returning();
      await tx.update(pedidos).set({ estado: "PAGADO", actualizadoEn: new Date() }).where(eq(pedidos.id, pedidoId));
      return comprobante;
    },
    { behavior: "immediate" },
  );
}

export async function obtenerComprobante(bd: BD, numero: number) {
  return bd.query.comprobantes.findFirst({
    where: eq(comprobantes.numero, numero),
    with: {
      pedido: { with: { items: true, mesa: true, mesero: { columns: { nombre: true } } } },
      emitidoPor: { columns: { nombre: true } },
      cierre: true,
    },
  });
}

/** Comprobantes emitidos que todavía no pertenecen a ningún cierre. */
export async function cajaAbierta(bd: BD) {
  const lista = await bd.query.comprobantes.findMany({
    where: isNull(comprobantes.cierreId),
    orderBy: asc(comprobantes.numero),
    with: { pedido: { with: { mesa: true } } },
  });
  return { comprobantes: lista, total: lista.reduce((s, c) => s + c.total, 0) };
}

/**
 * Registra un cierre de caja con fecha, responsable, total y cantidad de comprobantes.
 * Los comprobantes quedan asociados al cierre, así que el total guardado no cambia
 * aunque después se emitan nuevos comprobantes.
 */
export async function cerrarCaja(bd: BD, responsableId: number) {
  return bd.transaction(
    async (tx) => {
      const pendientes = await tx.select().from(comprobantes).where(isNull(comprobantes.cierreId));
      if (pendientes.length === 0) throw new ErrorNegocio("No hay comprobantes pendientes de cierre.");
      const [cierre] = await tx
        .insert(cierresCaja)
        .values({
          responsableId,
          total: pendientes.reduce((s, c) => s + c.total, 0),
          cantidadComprobantes: pendientes.length,
        })
        .returning();
      await tx
        .update(comprobantes)
        .set({ cierreId: cierre.id })
        .where(inArray(comprobantes.id, pendientes.map((c) => c.id)));
      return cierre;
    },
    { behavior: "immediate" },
  );
}

export async function listarCierres(bd: BD, limite = 30) {
  return bd.query.cierresCaja.findMany({
    orderBy: desc(cierresCaja.fechaHora),
    limit: limite,
    with: { responsable: { columns: { nombre: true } } },
  });
}

/** Ventas por día (zona horaria de Bogotá) y platos más vendidos en [desde, hasta). */
export async function reporteVentas(bd: BD, desde: Date, hasta: Date) {
  const enRango = and(gte(comprobantes.emitidoEn, desde), lt(comprobantes.emitidoEn, hasta));

  const lista = await bd.select().from(comprobantes).where(enRango).orderBy(asc(comprobantes.emitidoEn));
  const porDia = new Map<string, { dia: string; comprobantes: number; total: number }>();
  for (const c of lista) {
    const dia = diaBogota(c.emitidoEn);
    const fila = porDia.get(dia) ?? { dia, comprobantes: 0, total: 0 };
    fila.comprobantes += 1;
    fila.total += c.total;
    porDia.set(dia, fila);
  }

  const cantidad = sql<number>`sum(${pedidoItems.cantidad})`;
  const platosMasVendidos = await bd
    .select({
      plato: pedidoItems.nombrePlato,
      cantidad,
      total: sql<number>`sum(${pedidoItems.cantidad} * ${pedidoItems.precioUnitario})`,
    })
    .from(pedidoItems)
    .innerJoin(comprobantes, eq(comprobantes.pedidoId, pedidoItems.pedidoId))
    .where(enRango)
    .groupBy(pedidoItems.nombrePlato)
    .orderBy(desc(cantidad), asc(pedidoItems.nombrePlato))
    .limit(10);

  return {
    ventasPorDia: [...porDia.values()],
    totalPeriodo: lista.reduce((s, c) => s + c.total, 0),
    platosMasVendidos,
  };
}
