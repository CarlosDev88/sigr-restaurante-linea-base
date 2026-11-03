import { describe, expect, it, vi } from "vitest";
import { CERRADA, ConexionEventos, type EstadoConexion, type FuenteEventos } from "@/app/pedidos/conexion-eventos";
import { formatoSSE } from "@/lib/eventos/sse";

/** EventSource simulado: permite disparar open, mensajes y errores. */
class FuenteFalsa implements FuenteEventos {
  readyState = 0;
  onerror: ((e: Event) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;
  cerrada = false;
  private oyentes = new Map<string, ((e: MessageEvent) => void)[]>();
  addEventListener(tipo: string, fn: (e: MessageEvent) => void) {
    this.oyentes.set(tipo, [...(this.oyentes.get(tipo) ?? []), fn]);
  }
  close() {
    this.cerrada = true;
    this.readyState = CERRADA;
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  emitir(tipo: string, datos: unknown) {
    for (const fn of this.oyentes.get(tipo) ?? []) fn({ data: JSON.stringify(datos) } as MessageEvent);
  }
  fallar(readyState: number) {
    this.readyState = readyState;
    this.onerror?.(new Event("error"));
  }
}

function preparar(codigoAcceso = 200) {
  const fuentes: FuenteFalsa[] = [];
  const estados: EstadoConexion[] = [];
  const recibidos: unknown[] = [];
  const tareas: { fn: () => void; ms: number; cancelada?: boolean }[] = [];
  const verificarAcceso = vi.fn(async () => codigoAcceso);
  const conexion = new ConexionEventos<unknown>({
    url: "/api/pedidos/eventos",
    crearFuente: () => {
      const f = new FuenteFalsa();
      fuentes.push(f);
      return f;
    },
    verificarAcceso,
    alRecibir: (d) => recibidos.push(d),
    alCambiarEstado: (e) => estados.push(e),
    programar: (fn, ms) => {
      const t = { fn, ms };
      tareas.push(t);
      return t;
    },
    cancelar: (t) => {
      (t as { cancelada?: boolean }).cancelada = true;
    },
  });
  const pendientes = () => tareas.filter((t) => !t.cancelada);
  const ejecutarTarea = async () => {
    const t = pendientes()[0];
    tareas.splice(tareas.indexOf(t), 1);
    t.fn();
    await new Promise((r) => setTimeout(r, 0));
    return t.ms;
  };
  return { conexion, fuentes, estados, recibidos, tareas, pendientes, verificarAcceso, ejecutarTarea };
}

describe("formato SSE", () => {
  it("genera evento y datos en JSON terminados en línea en blanco", () => {
    expect(formatoSSE("pedidos", { a: 1 })).toBe('event: pedidos\ndata: {"a":1}\n\n');
  });
});

describe("ConexionEventos", () => {
  it("se conecta y entrega las instantáneas recibidas", () => {
    const { conexion, fuentes, estados, recibidos } = preparar();
    conexion.iniciar();
    fuentes[0].abrir();
    fuentes[0].emitir("pedidos", { pedidos: [1] });
    expect(estados).toEqual(["conectando", "conectado"]);
    expect(recibidos).toEqual([{ pedidos: [1] }]);
  });

  it("si la red falla y el navegador reintenta, muestra 'reconectando' y luego 'conectado'", () => {
    const { conexion, fuentes, estados } = preparar();
    conexion.iniciar();
    fuentes[0].abrir();
    fuentes[0].fallar(0); // CONNECTING: el navegador reintenta solo
    expect(estados.at(-1)).toBe("reconectando");
    fuentes[0].abrir();
    expect(estados.at(-1)).toBe("conectado");
    expect(fuentes).toHaveLength(1);
  });

  it("si la conexión queda cerrada, reintenta con espera exponencial verificando el acceso", async () => {
    const { conexion, fuentes, estados, ejecutarTarea, verificarAcceso } = preparar(200);
    conexion.iniciar();
    fuentes[0].fallar(CERRADA);
    expect(fuentes[0].cerrada).toBe(true);
    expect(estados.at(-1)).toBe("reconectando");
    expect(await ejecutarTarea()).toBe(1000);
    expect(verificarAcceso).toHaveBeenCalledTimes(1);
    expect(fuentes).toHaveLength(2);
    fuentes[1].fallar(CERRADA);
    expect(await ejecutarTarea()).toBe(2000);
    fuentes[2].abrir();
    expect(estados.at(-1)).toBe("conectado");
  });

  it("no insiste si el servidor responde 401/403 al verificar el acceso", async () => {
    const { conexion, fuentes, estados, ejecutarTarea, pendientes } = preparar(403);
    conexion.iniciar();
    fuentes[0].fallar(CERRADA);
    await ejecutarTarea();
    expect(estados.at(-1)).toBe("sin-permiso");
    expect(fuentes).toHaveLength(1);
    expect(pendientes()).toHaveLength(0);
  });

  it("el evento de cierre por falta de autorización termina la conexión", () => {
    const { conexion, fuentes, estados } = preparar();
    conexion.iniciar();
    fuentes[0].abrir();
    fuentes[0].emitir("cierre", { motivo: "SIN_AUTORIZACION" });
    expect(fuentes[0].cerrada).toBe(true);
    expect(estados.at(-1)).toBe("sin-permiso");
  });

  it("cerrar() libera la conexión y deja de reintentar", () => {
    const { conexion, fuentes, estados, pendientes } = preparar();
    conexion.iniciar();
    fuentes[0].abrir();
    fuentes[0].emitir("conexion", { latidoMs: 1000 });
    conexion.cerrar();
    fuentes[0].fallar(CERRADA);
    expect(fuentes[0].cerrada).toBe(true);
    expect(pendientes()).toHaveLength(0);
    expect(estados.at(-1)).toBe("cerrado");
  });

  it("detecta un corte silencioso: sin eventos durante 2,5 latidos cierra y reintenta", async () => {
    const { conexion, fuentes, estados, pendientes, ejecutarTarea } = preparar(200);
    conexion.iniciar();
    fuentes[0].abrir();
    fuentes[0].emitir("conexion", { latidoMs: 4000 });
    expect(pendientes().map((t) => t.ms)).toEqual([10_000]); // 2,5 × 4000

    // Cada latido reinicia el plazo.
    fuentes[0].emitir("latido", { t: 1 });
    expect(pendientes()).toHaveLength(1);

    // Vence el plazo sin eventos: se cierra la conexión y se programa un reintento.
    await ejecutarTarea();
    expect(fuentes[0].cerrada).toBe(true);
    expect(estados.at(-1)).toBe("reconectando");
    expect(pendientes().map((t) => t.ms)).toEqual([1000]);
    await ejecutarTarea();
    expect(fuentes).toHaveLength(2);
    fuentes[1].abrir();
    expect(estados.at(-1)).toBe("conectado");
  });
});
