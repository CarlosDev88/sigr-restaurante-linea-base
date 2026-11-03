"use server";

import { revalidatePath } from "next/cache";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoCOP } from "@/lib/domain/reglas";
import { cerrarCaja } from "@/lib/services/caja";

export async function accionCerrarCaja(_estado: EstadoAccion, _datos: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.caja);
  try {
    const cierre = await cerrarCaja(db, usuario.id);
    revalidatePath("/caja");
    return {
      mensaje: `Cierre N° ${cierre.id} registrado: ${cierre.cantidadFacturas} facturas por ${formatoCOP(cierre.total)}.`,
    };
  } catch (e) {
    return aEstadoError(e);
  }
}
