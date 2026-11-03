"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { cerrarCaja } from "@/lib/services/caja";

export async function accionCerrarCaja(_estado: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.caja);
  let id: number;
  try {
    id = (await cerrarCaja(db, usuario.id, String(f.get("jornada") ?? ""))).id;
  } catch (e) {
    return aEstadoError(e);
  }
  revalidatePath("/caja");
  // La jornada cerrada puede desaparecer de la lista de pendientes: el resultado se muestra en la página.
  redirect(`/caja?cierre=${id}`);
}
