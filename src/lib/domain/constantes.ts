export const ROLES = ["CLIENTE", "MESERO", "ADMIN"] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_PEDIDO = [
  "PENDIENTE",
  "EN_PREPARACION",
  "ENTREGADO",
  "PAGADO",
  "CANCELADO",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ESTADOS_RESERVA = ["PENDIENTE", "CONFIRMADA", "CANCELADA"] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/** Duración fija de una reserva, en minutos. */
export const DURACION_RESERVA_MIN = 120;

/** Franja en la que se puede iniciar una reserva (hora local de Bogotá). */
export const HORA_APERTURA_RESERVAS = 12; // 12:00
export const HORA_ULTIMA_RESERVA = 21; // 21:00 (último inicio permitido)

/** Zona horaria del restaurante. Colombia es UTC-5 sin horario de verano. */
export const ZONA_HORARIA = "America/Bogota";
export const OFFSET_BOGOTA = "-05:00";

/**
 * Intervalo de actualización automática del tablero de pedidos.
 * Un cambio de estado puede tardar hasta este tiempo (más la latencia de red)
 * en verse en otra pantalla.
 */
export const INTERVALO_ACTUALIZACION_MS = 5000;

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  ENTREGADO: "Entregado",
  PAGADO: "Pagado",
  CANCELADO: "Cancelado",
};

export const ETIQUETA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};
