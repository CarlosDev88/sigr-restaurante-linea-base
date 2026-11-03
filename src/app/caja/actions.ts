"use server";

import { revalidatePath } from "next/cache";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoCOP } from "@/lib/domain/reglas";
import { publicarCambioPedidos } from "@/lib/eventos/pedidos";
import { cerrarCaja, pagarPedido } from "@/lib/services/caja";

export async function accionPagarPedido(pedidoId: number): Promise<EstadoAccion & { numero?: number }> {
  const usuario = await exigirRol(PERMISOS.gestionarPedidos);
  try {
    const c = await pagarPedido(db, pedidoId, usuario.id);
    await publicarCambioPedidos(db, { tipo: "facturado", pedidoId });
    revalidatePath("/caja");
    return { mensaje: `Comprobante N° ${c.numero} emitido.`, numero: c.numero };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionCerrarCaja(_estado: EstadoAccion, _datos: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.caja);
  try {
    const cierre = await cerrarCaja(db, usuario.id);
    revalidatePath("/caja");
    return {
      mensaje: `Cierre N° ${cierre.id} registrado: ${cierre.cantidadComprobantes} comprobantes por ${formatoCOP(cierre.total)}.`,
    };
  } catch (e) {
    return aEstadoError(e);
  }
}
