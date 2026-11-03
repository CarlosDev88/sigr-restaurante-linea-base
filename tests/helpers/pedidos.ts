import type { BD } from "@/lib/db/cliente";
import { cambiarEstadoPedido, crearPedido } from "@/lib/services/pedidos";

/** Crea un pedido y lo lleva hasta ENTREGADO. */
export async function pedidoEntregado(
  bd: BD,
  meseroId: number,
  mesaId: number,
  items: { platoId: number; cantidad: number }[],
) {
  const p = await crearPedido(bd, meseroId, { mesaId, items });
  await cambiarEstadoPedido(bd, p.id, "EN_PREPARACION");
  await cambiarEstadoPedido(bd, p.id, "ENTREGADO");
  return p.id;
}
