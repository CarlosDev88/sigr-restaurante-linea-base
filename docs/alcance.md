# Alcance de la línea base v1.0.0

## Incluido

| Módulo | Funcionalidad |
|---|---|
| Autenticación | Inicio y cierre de sesión; roles cliente, mesero y administrador; verificación del rol en el servidor |
| Menú digital | CRUD de categorías y platos; menú público con platos disponibles |
| Pedidos | Registro por mesa; seguimiento de estados; tablero con actualización automática |
| Reservas | Reserva por fecha, hora y personas; asignación de mesa por capacidad y duración; confirmación y cancelación |
| Caja | Comprobante interno por pedido cobrado; cierre de caja persistido; reporte diario de ventas y platos más vendidos |

## Comprobante interno frente a factura electrónica

El sistema emite un **comprobante interno de venta** con número consecutivo, detalle (cantidad, plato, valor unitario y subtotal) y total. Sirve para control de caja y trazabilidad.

**No es una factura electrónica de venta.** En Colombia la factura electrónica debe cumplir los requisitos de la DIAN (resolución de numeración, CUFE, firma digital, XML UBL, validación previa y datos fiscales del comprador y del vendedor). Esa integración se deja fuera de la línea base y se tramitará como solicitud de cambio, normalmente mediante un proveedor tecnológico autorizado.

## Actualización de pedidos

El tablero de pedidos consulta `GET /api/pedidos` cada **5 segundos** (`INTERVALO_ACTUALIZACION_MS`). Un cambio hecho en otra pantalla aparece en un máximo de unos 5 segundos más la latencia de la red (en local, menos de 1 segundo adicional). La prueba E2E `03-pedidos-caja.spec.ts` verifica que el cambio se vea en otra sesión dentro de ese intervalo más 3 segundos. Quien hace el cambio lo ve de inmediato, porque su pantalla recarga después de cada acción.

No se usan WebSockets ni Server-Sent Events. La actualización inmediata queda como cambio futuro.

## Excluido (posibles solicitudes de cambio)

- Facturación electrónica DIAN.
- Pagos en línea y medios de pago.
- Notificaciones (correo, WhatsApp, push).
- Actualización inmediata por WebSockets o Server-Sent Events.
- Registro de nuevos usuarios desde la interfaz (en la línea base se crean con el seed).
- Gestión de mesas desde la interfaz.
- Motor de base de datos cliente-servidor y despliegue con varias instancias.
- Integración continua (por ejemplo, GitHub Actions o Jenkins), prevista para la unidad 3.
