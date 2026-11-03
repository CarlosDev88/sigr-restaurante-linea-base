import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { BD } from "../db/cliente";
import { mesas, pedidoItems, pedidos, platos } from "../db/schema";
import type { EstadoPedido } from "../domain/constantes";
import { calcularTotal, ErrorNegocio, puedeTransicionar, siguientesEstados } from "../domain/reglas";

export const esquemaPedido = z.object({
  mesaId: z.coerce.number().int().positive({ error: "Seleccione una mesa." }),
  items: z
    .array(
      z.object({
        platoId: z.coerce.number().int().positive(),
        cantidad: z.coerce
          .number()
          .int({ error: "La cantidad debe ser un número entero." })
          .min(1, { error: "La cantidad mínima es 1." })
          .max(50, { error: "La cantidad máxima por plato es 50." }),
      }),
    )
    .min(1, { error: "Agregue al menos un plato al pedido." }),
});

export type DatosPedido = z.input<typeof esquemaPedido>;

/** Registra un pedido copiando nombre y precio actuales de cada plato (no cambian si luego se edita el menú). */
export async function crearPedido(bd: BD, meseroId: number, datos: DatosPedido) {
  const { mesaId, items } = esquemaPedido.parse(datos);

  // Agrupa platos repetidos.
  const cantidades = new Map<number, number>();
  for (const i of items) cantidades.set(i.platoId, (cantidades.get(i.platoId) ?? 0) + i.cantidad);

  const [mesa] = await bd.select().from(mesas).where(eq(mesas.id, mesaId));
  if (!mesa) throw new ErrorNegocio("La mesa no existe.");

  const encontrados = await bd
    .select()
    .from(platos)
    .where(inArray(platos.id, [...cantidades.keys()]));
  for (const platoId of cantidades.keys()) {
    const p = encontrados.find((x) => x.id === platoId);
    if (!p) throw new ErrorNegocio("Uno de los platos no existe.");
    if (!p.disponible) throw new ErrorNegocio(`"${p.nombre}" no está disponible.`);
  }

  return bd.transaction(async (tx) => {
    const [pedido] = await tx.insert(pedidos).values({ mesaId, meseroId }).returning();
    await tx.insert(pedidoItems).values(
      encontrados.map((p) => ({
        pedidoId: pedido.id,
        platoId: p.id,
        nombrePlato: p.nombre,
        precioUnitario: p.precio,
        cantidad: cantidades.get(p.id)!,
      })),
    );
    return pedido;
  });
}

export interface PedidoResumen {
  id: number;
  mesa: number;
  mesero: string;
  estado: EstadoPedido;
  creadoEn: string;
  actualizadoEn: string;
  items: { nombre: string; cantidad: number; precioUnitario: number }[];
  total: number;
  siguientes: EstadoPedido[];
  comprobanteNumero: number | null;
}

/** Pedidos en curso (no pagados ni cancelados), del más antiguo al más reciente. */
export async function listarPedidosActivos(bd: BD): Promise<PedidoResumen[]> {
  const filas = await bd.query.pedidos.findMany({
    where: notInArray(pedidos.estado, ["PAGADO", "CANCELADO"]),
    orderBy: asc(pedidos.creadoEn),
    with: { mesa: true, mesero: { columns: { nombre: true } }, items: true, comprobante: true },
  });
  return filas.map((p) => ({
    id: p.id,
    mesa: p.mesa.numero,
    mesero: p.mesero.nombre,
    estado: p.estado,
    creadoEn: p.creadoEn.toISOString(),
    actualizadoEn: p.actualizadoEn.toISOString(),
    items: p.items.map((i) => ({ nombre: i.nombrePlato, cantidad: i.cantidad, precioUnitario: i.precioUnitario })),
    total: calcularTotal(p.items),
    siguientes: siguientesEstados(p.estado),
    comprobanteNumero: p.comprobante?.numero ?? null,
  }));
}

/**
 * Cambia el estado operativo de un pedido. El paso a PAGADO no se hace aquí:
 * requiere emitir comprobante (módulo de caja).
 */
export async function cambiarEstadoPedido(bd: BD, pedidoId: number, nuevo: EstadoPedido) {
  if (nuevo === "PAGADO") {
    throw new ErrorNegocio("El pago se registra emitiendo el comprobante.");
  }
  const [p] = await bd.select().from(pedidos).where(eq(pedidos.id, pedidoId));
  if (!p) throw new ErrorNegocio("El pedido no existe.");
  if (!puedeTransicionar(p.estado, nuevo)) {
    throw new ErrorNegocio(`No se puede pasar de ${p.estado} a ${nuevo}.`);
  }
  // La condición sobre el estado anterior evita que dos pantallas apliquen cambios cruzados.
  const actualizados = await bd
    .update(pedidos)
    .set({ estado: nuevo, actualizadoEn: new Date() })
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.estado, p.estado)))
    .returning();
  if (actualizados.length === 0) throw new ErrorNegocio("El pedido cambió mientras tanto; recargue.");
  return actualizados[0];
}
