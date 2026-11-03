import { jwtVerify, SignJWT } from "jose";
import { ROLES, type Rol } from "../domain/constantes";

export interface DatosSesion {
  id: number;
  rol: Rol;
}

export const DURACION_SESION_SEG = 8 * 60 * 60; // 8 horas (un turno)

function clave(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error("SESSION_SECRET no está definido o tiene menos de 32 caracteres.");
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(datos: DatosSesion): Promise<string> {
  return new SignJWT({ rol: datos.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(datos.id))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(clave());
}

/** Devuelve los datos de la sesión o null si el token es inválido, fue alterado o expiró. */
export async function verificarSesion(token: string | undefined): Promise<DatosSesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    const rol = payload.rol as Rol;
    if (!Number.isInteger(id) || !ROLES.includes(rol)) return null;
    return { id, rol };
  } catch {
    return null;
  }
}
