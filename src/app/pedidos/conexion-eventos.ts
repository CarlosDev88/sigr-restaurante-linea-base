// Gestión de la conexión de eventos del tablero (lado del navegador).
// Separada del componente para poder probarla con un EventSource simulado.

export type EstadoConexion = "conectando" | "conectado" | "reconectando" | "sin-permiso" | "cerrado";

/** Subconjunto de EventSource que se usa (permite inyectar uno falso en pruebas). */
export interface FuenteEventos {
  readonly readyState: number;
  addEventListener(tipo: string, oyente: (e: MessageEvent) => void): void;
  close(): void;
  onerror: ((e: Event) => void) | null;
  onopen: ((e: Event) => void) | null;
}

export const CERRADA = 2;
export const REINTENTO_BASE_MS = 1000;
export const REINTENTO_MAX_MS = 30_000;
/** Si no llega ningún evento (ni latido) en este múltiplo del latido, la conexión se da por perdida. */
export const FACTOR_VIGILANCIA = 2.5;
export const VIGILANCIA_MIN_MS = 5000;

interface Opciones<T> {
  url: string;
  crearFuente: (url: string) => FuenteEventos;
  /** Consulta si la sesión sigue autorizada; devuelve el código HTTP. */
  verificarAcceso: () => Promise<number>;
  alRecibir: (datos: T) => void;
  alCambiarEstado: (estado: EstadoConexion, info: { conexiones: number }) => void;
  programar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
}

/**
 * - El navegador reconecta solo cuando la red falla (readyState CONNECTING): estado "reconectando".
 * - Si la conexión queda CERRADA (p. ej. el servidor respondió con error o se reinició), se reintenta
 *   con espera exponencial (1 s, 2 s, 4 s… máximo 30 s), verificando antes la autorización:
 *   401/403 → "sin-permiso" y no se insiste.
 * - El evento `cierre` con SIN_AUTORIZACION termina la conexión sin reintentar.
 * - Vigilancia: el servidor informa su intervalo de latido (evento `conexion`) y envía `latido`
 *   periódicamente. Si pasan FACTOR_VIGILANCIA × latido sin ningún evento (corte silencioso de red,
 *   proxy que retiene datos), se cierra la conexión y se reintenta como en el caso anterior.
 * - Al reconectar, el servidor envía una instantánea completa: no se pierden cambios ocurridos durante el corte.
 */
export class ConexionEventos<T> {
  private fuente: FuenteEventos | null = null;
  private temporizador: unknown = null;
  private vigilancia: unknown = null;
  private limiteSilencioMs: number | null = null;
  private intentos = 0;
  private conexiones = 0;
  private terminado = false;
  private estado: EstadoConexion = "conectando";
  private readonly programar: (fn: () => void, ms: number) => unknown;
  private readonly cancelar: (id: unknown) => void;

  constructor(private readonly o: Opciones<T>) {
    this.programar = o.programar ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancelar = o.cancelar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  iniciar() {
    this.terminado = false;
    this.conectar();
  }

  /** Reintenta de inmediato (por ejemplo, cuando el navegador vuelve a estar en línea). */
  reintentarAhora() {
    if (this.terminado || this.estado === "conectado") return;
    if (this.temporizador !== null) this.cancelar(this.temporizador);
    this.temporizador = null;
    this.detenerVigilancia();
    this.intentos = 0;
    this.fuente?.close();
    this.conectar();
  }

  private detenerVigilancia() {
    if (this.vigilancia !== null) this.cancelar(this.vigilancia);
    this.vigilancia = null;
  }

  /** Reinicia el plazo máximo sin recibir eventos (solo cuando el servidor informó su latido). */
  private vigilar(fuente: FuenteEventos) {
    this.detenerVigilancia();
    if (this.limiteSilencioMs === null || this.terminado) return;
    this.vigilancia = this.programar(() => {
      this.vigilancia = null;
      if (this.terminado || this.fuente !== fuente) return;
      fuente.close();
      this.programarReintento();
    }, this.limiteSilencioMs);
  }

  cerrar(estado: EstadoConexion = "cerrado") {
    this.terminado = true;
    this.detenerVigilancia();
    if (this.temporizador !== null) this.cancelar(this.temporizador);
    this.temporizador = null;
    this.fuente?.close();
    this.fuente = null;
    this.cambiar(estado);
  }

  private cambiar(estado: EstadoConexion) {
    this.estado = estado;
    this.o.alCambiarEstado(estado, { conexiones: this.conexiones });
  }

  private conectar() {
    if (this.terminado) return;
    this.cambiar(this.intentos === 0 && this.conexiones === 0 ? "conectando" : "reconectando");
    const fuente = this.o.crearFuente(this.o.url);
    this.fuente = fuente;

    fuente.onopen = () => {
      this.intentos = 0;
      this.conexiones += 1;
      this.cambiar("conectado");
      this.vigilar(fuente);
    };
    fuente.addEventListener("conexion", (e) => {
      const { latidoMs } = JSON.parse(e.data) as { latidoMs: number };
      this.limiteSilencioMs = Math.max(latidoMs * FACTOR_VIGILANCIA, VIGILANCIA_MIN_MS);
      this.vigilar(fuente);
    });
    fuente.addEventListener("latido", () => this.vigilar(fuente));
    fuente.addEventListener("pedidos", (e) => {
      this.vigilar(fuente);
      this.o.alRecibir(JSON.parse(e.data) as T);
    });
    fuente.addEventListener("cierre", (e) => {
      const { motivo } = JSON.parse(e.data) as { motivo: string };
      if (motivo === "SIN_AUTORIZACION") this.cerrar("sin-permiso");
      // RENOVAR: el navegador reconecta solo tras el tiempo `retry`.
    });
    fuente.onerror = () => {
      if (this.terminado || this.fuente !== fuente) return;
      this.detenerVigilancia();
      if (fuente.readyState !== CERRADA) {
        this.cambiar("reconectando"); // el navegador reintenta automáticamente
        return;
      }
      fuente.close();
      this.programarReintento();
    };
  }

  private programarReintento() {
    const espera = Math.min(REINTENTO_BASE_MS * 2 ** this.intentos, REINTENTO_MAX_MS);
    this.intentos += 1;
    this.cambiar("reconectando");
    this.temporizador = this.programar(async () => {
      this.temporizador = null;
      let codigo = 0;
      try {
        codigo = await this.o.verificarAcceso();
      } catch {
        codigo = 0; // sin red: se vuelve a intentar
      }
      if (codigo === 401 || codigo === 403) this.cerrar("sin-permiso");
      else if (codigo >= 200 && codigo < 300) this.conectar();
      else this.programarReintento();
    }, espera);
  }
}
