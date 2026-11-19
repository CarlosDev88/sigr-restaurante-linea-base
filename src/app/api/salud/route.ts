import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import paquete from "../../../../package.json";

export const dynamic = "force-dynamic";

const inicio = Date.now();

/**
 * Verificación de salud (pública, sin datos de negocio). La usan el HEALTHCHECK del contenedor
 * y las pruebas de humo del pipeline para saber si la aplicación y la base de datos responden.
 * 200 → todo bien; 503 → la base de datos no responde.
 */
export async function GET() {
  let baseDeDatos: "ok" | "error" = "ok";
  try {
    await db.$client.execute("SELECT 1");
  } catch {
    baseDeDatos = "error";
  }
  const cuerpo = {
    estado: baseDeDatos === "ok" ? "ok" : "degradado",
    version: process.env.APP_VERSION || paquete.version,
    commit: process.env.GIT_SHA || null,
    baseDeDatos,
    tiempoActivoSeg: Math.round((Date.now() - inicio) / 1000),
  };
  return NextResponse.json(cuerpo, {
    status: baseDeDatos === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
