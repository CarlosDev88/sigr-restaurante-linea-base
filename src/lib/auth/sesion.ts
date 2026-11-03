import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { usuarios } from "../db/schema";
import type { Rol } from "../domain/constantes";
import { autorizar, type UsuarioSesion } from "./permisos";
import { DURACION_SESION_SEG, firmarSesion, verificarSesion } from "./token";

export const COOKIE_SESION = "sigr_sesion";

function cookieSegura() {
  return process.env.NODE_ENV === "production" && process.env.COOKIE_SEGURA !== "false";
}

export async function crearSesion(usuario: { id: number; rol: Rol }) {
  const token = await firmarSesion({ id: usuario.id, rol: usuario.rol });
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSegura(),
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE_SESION);
}

/**
 * Usuario de la solicitud actual. Verifica la firma del token y vuelve a leer el usuario
 * en la base de datos, de modo que el rol vigente es siempre el almacenado.
 */
export const obtenerUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const datos = await verificarSesion((await cookies()).get(COOKIE_SESION)?.value);
  if (!datos) return null;
  const [u] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol })
    .from(usuarios)
    .where(eq(usuarios.id, datos.id));
  return u ?? null;
});

/**
 * Exige un usuario con alguno de los roles indicados. Se llama al inicio de cada página
 * protegida y de cada Server Action: el Proxy por sí solo no basta.
 */
export async function exigirRol(rolesPermitidos: readonly Rol[]): Promise<UsuarioSesion> {
  const r = autorizar(await obtenerUsuarioActual(), rolesPermitidos);
  if (!r.ok) redirect(r.motivo === "NO_AUTENTICADO" ? "/login" : "/no-autorizado");
  return r.usuario;
}
