import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { BD } from "../db/cliente";
import { cierresCaja, facturaItems, facturas } from "../db/schema";
import { diaBogota, ErrorNegocio } from "../domain/reglas";

/** Facturas emitidas que todavía no pertenecen a ningún cierre. */
export async function cajaAbierta(bd: BD) {
  const lista = await bd.select().from(facturas).where(isNull(facturas.cierreId)).orderBy(asc(facturas.numero));
  return { facturas: lista, total: lista.reduce((s, f) => s + f.total, 0) };
}

/**
 * Registra un cierre de caja con fecha, responsable, total y cantidad de facturas.
 * Las facturas quedan asociadas al cierre, así que el total guardado no cambia
 * aunque después se emitan nuevas facturas.
 */
export async function cerrarCaja(bd: BD, responsableId: number) {
  return bd.transaction(
    async (tx) => {
      const pendientes = await tx.select().from(facturas).where(isNull(facturas.cierreId));
      if (pendientes.length === 0) throw new ErrorNegocio("No hay facturas pendientes de cierre.");
      const [cierre] = await tx
        .insert(cierresCaja)
        .values({
          responsableId,
          total: pendientes.reduce((s, f) => s + f.total, 0),
          cantidadFacturas: pendientes.length,
        })
        .returning();
      await tx
        .update(facturas)
        .set({ cierreId: cierre.id })
        .where(inArray(facturas.id, pendientes.map((f) => f.id)));
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

/** Ventas por día (zona horaria de Bogotá) y productos más vendidos en [desde, hasta), según facturas. */
export async function reporteVentas(bd: BD, desde: Date, hasta: Date) {
  const enRango = and(gte(facturas.emitidaEn, desde), lt(facturas.emitidaEn, hasta));

  const lista = await bd.select().from(facturas).where(enRango).orderBy(asc(facturas.emitidaEn));
  const porDia = new Map<string, { dia: string; facturas: number; total: number }>();
  for (const f of lista) {
    const dia = diaBogota(f.emitidaEn);
    const fila = porDia.get(dia) ?? { dia, facturas: 0, total: 0 };
    fila.facturas += 1;
    fila.total += f.total;
    porDia.set(dia, fila);
  }

  const cantidad = sql<number>`sum(${facturaItems.cantidad})`;
  const platosMasVendidos = await bd
    .select({ plato: facturaItems.descripcion, cantidad, total: sql<number>`sum(${facturaItems.valorTotal})` })
    .from(facturaItems)
    .innerJoin(facturas, eq(facturas.id, facturaItems.facturaId))
    .where(enRango)
    .groupBy(facturaItems.descripcion)
    .orderBy(desc(cantidad), asc(facturaItems.descripcion))
    .limit(10);

  return { ventasPorDia: [...porDia.values()], totalPeriodo: lista.reduce((s, f) => s + f.total, 0), platosMasVendidos };
}
