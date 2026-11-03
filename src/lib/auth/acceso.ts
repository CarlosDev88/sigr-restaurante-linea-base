import { eq } from "drizzle-orm";
import type { BD } from "../db/cliente";
import { usuarios } from "../db/schema";
import type { UsuarioSesion } from "./permisos";
import { verificarSesion } from "./token";

/**
 * Resuelve el usuario a partir del token de sesión: verifica firma y vencimiento y
 * vuelve a leer el usuario en la base de datos (el rol vigente es el almacenado).
 * No depende de `next/headers`, por eso lo usan también las conexiones de eventos.
 */
export async function usuarioDesdeToken(bd: BD, token: string | undefined): Promise<UsuarioSesion | null> {
  const datos = await verificarSesion(token);
  if (!datos) return null;
  const [u] = await bd
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol })
    .from(usuarios)
    .where(eq(usuarios.id, datos.id));
  return u ?? null;
}
