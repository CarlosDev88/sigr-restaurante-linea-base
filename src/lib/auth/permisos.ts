import type { Rol } from "../domain/constantes";

export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export type ResultadoAutorizacion =
  | { ok: true; usuario: UsuarioSesion }
  | { ok: false; motivo: "NO_AUTENTICADO" | "SIN_PERMISO" };

/** Regla única de autorización: la usan páginas, Server Actions y Route Handlers. */
export function autorizar(usuario: UsuarioSesion | null, rolesPermitidos: readonly Rol[]): ResultadoAutorizacion {
  if (!usuario) return { ok: false, motivo: "NO_AUTENTICADO" };
  if (!rolesPermitidos.includes(usuario.rol)) return { ok: false, motivo: "SIN_PERMISO" };
  return { ok: true, usuario };
}

/** Matriz de permisos por módulo (fuente única, usada también en la navegación). */
export const PERMISOS = {
  administrarMenu: ["ADMIN"],
  gestionarPedidos: ["MESERO", "ADMIN"],
  crearReserva: ["CLIENTE"],
  administrarReservas: ["ADMIN"],
  caja: ["ADMIN"],
  verComprobantes: ["MESERO", "ADMIN"],
} as const satisfies Record<string, readonly Rol[]>;
