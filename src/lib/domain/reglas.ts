import {
  DURACION_RESERVA_MIN,
  HORA_APERTURA_RESERVAS,
  HORA_ULTIMA_RESERVA,
  OFFSET_BOGOTA,
  ZONA_HORARIA,
  type EstadoPedido,
} from "./constantes";

/** Error de negocio: su mensaje se puede mostrar al usuario. */
export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

// ---------- Pedidos ----------

const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE: ["EN_PREPARACION", "CANCELADO"],
  EN_PREPARACION: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: ["PAGADO"],
  PAGADO: [],
  CANCELADO: [],
};

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export function siguientesEstados(desde: EstadoPedido): EstadoPedido[] {
  return TRANSICIONES[desde];
}

export function calcularTotal(items: { precioUnitario: number; cantidad: number }[]): number {
  return items.reduce((suma, i) => suma + i.precioUnitario * i.cantidad, 0);
}

// ---------- Reservas ----------

export interface Intervalo {
  inicio: Date;
  fin: Date;
}

/** Dos intervalos [inicio, fin) se solapan si uno empieza antes de que el otro termine. */
export function seSolapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Convierte fecha (AAAA-MM-DD) y hora (HH:MM) locales de Bogotá a un Date (UTC). */
export function fechaHoraBogota(fecha: string, hora: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    throw new ErrorNegocio("Fecha u hora con formato inválido.");
  }
  const d = new Date(`${fecha}T${hora}:00${OFFSET_BOGOTA}`);
  if (Number.isNaN(d.getTime())) throw new ErrorNegocio("Fecha u hora inválida.");
  return d;
}

export function finDeReserva(inicio: Date): Date {
  return new Date(inicio.getTime() + DURACION_RESERVA_MIN * 60_000);
}

export function validarHorarioReserva(inicio: Date, ahora: Date = new Date()): void {
  if (inicio.getTime() <= ahora.getTime()) {
    throw new ErrorNegocio("La reserva debe ser en una fecha y hora futura.");
  }
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: ZONA_HORARIA }).format(inicio),
  );
  const minutos = inicio.getUTCMinutes();
  if (hora < HORA_APERTURA_RESERVAS || hora > HORA_ULTIMA_RESERVA || (hora === HORA_ULTIMA_RESERVA && minutos > 0)) {
    throw new ErrorNegocio(
      `Las reservas inician entre las ${HORA_APERTURA_RESERVAS}:00 y las ${HORA_ULTIMA_RESERVA}:00.`,
    );
  }
}

// ---------- Utilidades ----------

/** Día calendario (AAAA-MM-DD) de una fecha en la zona horaria del restaurante. */
export function diaBogota(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(fecha);
}

export function formatoCOP(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export function formatoFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}
