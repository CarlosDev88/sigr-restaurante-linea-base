"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { publicarCambioPedidos } from "@/lib/eventos/pedidos";
import { facturarPedido, type DatosFacturar } from "@/lib/services/facturacion";

export async function accionFacturarPedido(_estado: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.facturar);
  const pedidoId = Number(f.get("pedidoId"));
  let numero: number;
  try {
    // Solo se reciben datos del cliente y medio de pago; los valores se calculan en el servidor.
    const datos = Object.fromEntries(
      ["tipoCliente", "medioPago", "clienteTipoDocumento", "clienteNumeroDocumento", "clienteNombre", "clienteEmail"].map(
        (k) => [k, String(f.get(k) ?? "")],
      ),
    ) as unknown as DatosFacturar;
    const factura = await facturarPedido(db, pedidoId, usuario.id, datos);
    numero = factura.numero;
    await publicarCambioPedidos(db, { tipo: "facturado", pedidoId });
  } catch (e) {
    return aEstadoError(e);
  }
  revalidatePath("/caja");
  revalidatePath("/facturas");
  redirect(`/facturas/${numero}`);
}
