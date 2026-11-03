import { NextResponse, type NextRequest } from "next/server";
import { usuarioDesdeToken } from "@/lib/auth/acceso";
import { autorizar, PERMISOS } from "@/lib/auth/permisos";
import { COOKIE_SESION } from "@/lib/auth/token";
import { db } from "@/lib/db";
import { instantaneaPedidos, suscribirPedidos } from "@/lib/eventos/pedidos";
import { configuracionSSE, formatoSSE, LATIDO_SSE, type MotivoCierre } from "@/lib/eventos/sse";

export const dynamic = "force-dynamic";

/**
 * Canal de eventos (Server-Sent Events) del tablero de pedidos.
 *
 * - Autoriza ANTES de abrir el canal: sin sesión → 401, rol sin permiso → 403 (no se envía ningún dato).
 * - Envía una instantánea al conectar y otra después de cada cambio de pedidos.
 * - Cada `latidoMs` envía un latido y vuelve a verificar sesión y rol; si ya no son válidos,
 *   envía `cierre` (SIN_AUTORIZACION) y cierra.
 * - Al cumplir `duracionMaxMs` envía `cierre` (RENOVAR) y cierra; el navegador reconecta y se reautoriza.
 * - Si el cliente se desconecta, se liberan la suscripción y los temporizadores.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_SESION)?.value;
  const acceso = autorizar(await usuarioDesdeToken(db, token), PERMISOS.gestionarPedidos);
  if (!acceso.ok) {
    return acceso.motivo === "NO_AUTENTICADO"
      ? NextResponse.json({ error: "No autenticado" }, { status: 401 })
      : NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { latidoMs, duracionMaxMs, reintentoMs } = configuracionSSE();
  const codificador = new TextEncoder();
  let cerrar: (motivo?: MotivoCierre) => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cerrado = false;
      const escribir = (texto: string) => {
        if (cerrado) return;
        try {
          controller.enqueue(codificador.encode(texto));
        } catch {
          cerrar();
        }
      };

      escribir(`retry: ${reintentoMs}\n\n`);
      escribir(formatoSSE("pedidos", await instantaneaPedidos(db, { tipo: "inicial" })));

      const desuscribir = suscribirPedidos((i) => escribir(formatoSSE("pedidos", i)));

      const latido = setInterval(async () => {
        const vigente = autorizar(await usuarioDesdeToken(db, token), PERMISOS.gestionarPedidos);
        if (!vigente.ok) cerrar("SIN_AUTORIZACION");
        else escribir(LATIDO_SSE);
      }, latidoMs);

      const limite = setTimeout(() => cerrar("RENOVAR"), duracionMaxMs);

      cerrar = (motivo) => {
        if (cerrado) return;
        if (motivo) escribir(formatoSSE("cierre", { motivo }));
        cerrado = true;
        desuscribir();
        clearInterval(latido);
        clearTimeout(limite);
        try {
          controller.close();
        } catch {
          // ya estaba cerrado por el cliente
        }
      };

      if (request.signal.aborted) cerrar();
      else request.signal.addEventListener("abort", () => cerrar());
    },
    cancel() {
      cerrar();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform evita que la compresión de Next.js acumule los eventos.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
