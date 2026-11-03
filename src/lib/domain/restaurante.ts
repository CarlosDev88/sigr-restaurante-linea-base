/**
 * Datos del restaurante que aparecen como emisor en las facturas.
 * Valores ficticios para uso académico; se pueden cambiar por variables de entorno.
 * Cada factura guarda una copia, de modo que cambiarlos no altera facturas ya emitidas.
 */
export interface DatosEmisor {
  razonSocial: string;
  nit: string;
  direccion: string;
  telefono: string;
}

export const EMISOR_POR_DEFECTO: DatosEmisor = {
  razonSocial: "SIGR Restaurante Académico S.A.S.",
  nit: "900.000.000-0",
  direccion: "Calle de ejemplo # 00-00, Bucaramanga, Santander",
  telefono: "+57 607 000 0000",
};

export function datosEmisor(): DatosEmisor {
  return {
    razonSocial: process.env.RESTAURANTE_RAZON_SOCIAL || EMISOR_POR_DEFECTO.razonSocial,
    nit: process.env.RESTAURANTE_NIT || EMISOR_POR_DEFECTO.nit,
    direccion: process.env.RESTAURANTE_DIRECCION || EMISOR_POR_DEFECTO.direccion,
    telefono: process.env.RESTAURANTE_TELEFONO || EMISOR_POR_DEFECTO.telefono,
  };
}
