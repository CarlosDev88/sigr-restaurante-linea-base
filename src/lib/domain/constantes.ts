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

export const MEDIOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "NO_REGISTRADO"] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];
/** Medios que se pueden elegir al facturar (NO_REGISTRADO solo existe en facturas migradas de la v1.0.0). */
export const MEDIOS_PAGO_SELECCIONABLES = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

export const TIPOS_DOCUMENTO = ["CC", "CE", "NIT", "PAS"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  NIT: "NIT",
  PAS: "Pasaporte",
};

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  NO_REGISTRADO: "No registrado",
};

/**
 * Impuesto nacional al consumo para servicio de restaurante (porcentaje). Los precios del menú
 * lo incluyen; la factura lo discrimina. Valor de referencia académica, configurable aquí.
 */
export const TASA_IMPUESTO_CONSUMO = 8;

export const PREFIJO_FACTURA = "FA";

/** Duración fija de una reserva, en minutos. */
export const DURACION_RESERVA_MIN = 120;

/** Franja en la que se puede iniciar una reserva (hora local de Bogotá). */
export const HORA_APERTURA_RESERVAS = 12; // 12:00
export const HORA_ULTIMA_RESERVA = 21; // 21:00 (último inicio permitido)

/** Zona horaria del restaurante. Colombia es UTC-5 sin horario de verano. */
export const ZONA_HORARIA = "America/Bogota";
export const OFFSET_BOGOTA = "-05:00";

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
