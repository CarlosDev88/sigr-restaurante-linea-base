"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { cerrarSesion, crearSesion } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { autenticar } from "@/lib/services/usuarios";

const esquemaLogin = z.object({
  email: z.email({ error: "Correo inválido." }),
  password: z.string().min(1, { error: "Ingrese la contraseña." }),
});

// Acción pública: es el punto de entrada para obtener una sesión.
export async function iniciarSesion(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { email, password } = esquemaLogin.parse(Object.fromEntries(datos));
    const usuario = await autenticar(db, email, password);
    if (!usuario) return { error: "Correo o contraseña incorrectos." };
    await crearSesion(usuario);
  } catch (e) {
    return aEstadoError(e);
  }
  redirect("/");
}

// Acción pública: cerrar sesión no requiere rol.
export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
