"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ESTADOS_PEDIDO, type EstadoPedido } from "@/lib/domain/constantes";
import { publicarCambioPedidos } from "@/lib/eventos/pedidos";
import { cambiarEstadoPedido, crearPedido } from "@/lib/services/pedidos";

export async function accionCrearPedido(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.gestionarPedidos);
  const items = [...f.entries()]
    .filter(([clave, valor]) => clave.startsWith("cant_") && Number(valor) > 0)
    .map(([clave, valor]) => ({ platoId: Number(clave.slice(5)), cantidad: valor }));
  try {
    const pedido = await crearPedido(db, usuario.id, { mesaId: f.get("mesaId"), items });
    await publicarCambioPedidos(db, { tipo: "creado", pedidoId: pedido.id });
  } catch (e) {
    return aEstadoError(e);
  }
  revalidatePath("/pedidos");
  redirect("/pedidos");
}

export async function accionCambiarEstado(pedidoId: number, estado: EstadoPedido): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.gestionarPedidos);
  try {
    if (!ESTADOS_PEDIDO.includes(estado)) return { error: "Estado inválido." };
    await cambiarEstadoPedido(db, pedidoId, estado);
    await publicarCambioPedidos(db, { tipo: "estado", pedidoId });
    return { mensaje: "Estado actualizado." };
  } catch (e) {
    return aEstadoError(e);
  }
}
