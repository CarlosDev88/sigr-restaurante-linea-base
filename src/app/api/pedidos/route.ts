import { NextResponse } from "next/server";
import { autorizar, PERMISOS } from "@/lib/auth/permisos";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { listarPedidosActivos } from "@/lib/services/pedidos";

// Fuente de datos del tablero de pedidos (consultada periódicamente por el navegador).
export async function GET() {
  const r = autorizar(await obtenerUsuarioActual(), PERMISOS.gestionarPedidos);
  if (!r.ok) {
    return r.motivo === "NO_AUTENTICADO"
      ? NextResponse.json({ error: "No autenticado" }, { status: 401 })
      : NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }
  const pedidos = await listarPedidosActivos(db);
  return NextResponse.json(
    { generadoEn: new Date().toISOString(), pedidos },
    { headers: { "Cache-Control": "no-store" } },
  );
}
