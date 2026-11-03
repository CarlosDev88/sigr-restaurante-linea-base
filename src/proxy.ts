import { NextResponse, type NextRequest } from "next/server";
import { verificarSesion } from "@/lib/auth/token";

const COOKIE_SESION = "sigr_sesion";

/**
 * Verificación optimista: si no hay sesión válida, redirige a /login antes de renderizar.
 * NO reemplaza la autorización por rol, que se hace en cada página, Server Action y
 * Route Handler (ver src/lib/auth/sesion.ts → exigirRol).
 */
export async function proxy(request: NextRequest) {
  const sesion = await verificarSesion(request.cookies.get(COOKIE_SESION)?.value);
  if (sesion) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/pedidos/:path*", "/reservas/:path*", "/caja/:path*", "/admin/:path*", "/comprobantes/:path*", "/api/:path*"],
};
