/** Formatea un evento según el protocolo Server-Sent Events. */
export function formatoSSE(evento: string, datos: unknown): string {
  return `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
}

/** Comentario SSE: lo ignora el navegador, mantiene viva la conexión. */
export const LATIDO_SSE = ": latido\n\n";

export type MotivoCierre = "SIN_AUTORIZACION" | "RENOVAR";

/** Parámetros de las conexiones de eventos (configurables por entorno). */
export function configuracionSSE() {
  const num = (v: string | undefined, porDefecto: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : porDefecto;
  };
  return {
    /** Cada cuánto se envía un latido y se vuelve a verificar la autorización. */
    latidoMs: num(process.env.SSE_LATIDO_MS, 15_000),
    /** Duración máxima de una conexión; al cumplirse el cliente se reconecta y se reautoriza. */
    duracionMaxMs: num(process.env.SSE_DURACION_MAX_MS, 10 * 60_000),
    /** Espera sugerida al navegador antes de reconectar (campo `retry`). */
    reintentoMs: num(process.env.SSE_REINTENTO_MS, 2_000),
  };
}
