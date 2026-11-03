import { ZodError } from "zod";
import { ErrorNegocio } from "./domain/reglas";

/** Estado que devuelven las Server Actions usadas con `useActionState`. */
export interface EstadoAccion {
  error?: string;
  mensaje?: string;
}

/**
 * Convierte errores esperados (validación o reglas de negocio) en un mensaje para el usuario.
 * Cualquier otro error, incluidos los `redirect()` de Next.js, se vuelve a lanzar.
 */
export function aEstadoError(e: unknown): EstadoAccion {
  if (e instanceof ErrorNegocio) return { error: e.message };
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Datos inválidos." };
  throw e;
}
