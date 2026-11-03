"use server";

import { revalidatePath } from "next/cache";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoFechaHora } from "@/lib/domain/reglas";
import { cancelarReserva, confirmarReserva, crearReserva } from "@/lib/services/reservas";

export async function accionCrearReserva(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol(PERMISOS.crearReserva);
  try {
    const r = await crearReserva(db, usuario.id, {
      fecha: String(f.get("fecha") ?? ""),
      hora: String(f.get("hora") ?? ""),
      personas: f.get("personas"),
    });
    revalidatePath("/reservas");
    return { mensaje: `Reserva registrada: mesa ${r.mesaNumero}, ${formatoFechaHora(r.inicio)}.` };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionCancelarReserva(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  const usuario = await exigirRol([...PERMISOS.crearReserva, ...PERMISOS.administrarReservas]);
  try {
    await cancelarReserva(db, Number(f.get("id")), usuario);
    revalidatePath("/reservas");
    revalidatePath("/admin/reservas");
    return { mensaje: "Reserva cancelada." };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionConfirmarReserva(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarReservas);
  try {
    await confirmarReserva(db, Number(f.get("id")));
    revalidatePath("/admin/reservas");
    return { mensaje: "Reserva confirmada." };
  } catch (e) {
    return aEstadoError(e);
  }
}
