import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { BD } from "../db/cliente";
import { usuarios } from "../db/schema";
import type { UsuarioSesion } from "../auth/permisos";

/** Valida credenciales. Devuelve null sin indicar cuál dato falló. */
export async function autenticar(bd: BD, email: string, password: string): Promise<UsuarioSesion | null> {
  const [u] = await bd.select().from(usuarios).where(eq(usuarios.email, email.trim().toLowerCase()));
  if (!u) return null;
  if (!(await bcrypt.compare(password, u.passwordHash))) return null;
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
}
