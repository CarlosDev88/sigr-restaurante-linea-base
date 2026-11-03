# Alcance funcional

Versión vigente: **v1.1.0**. La línea base original es **v1.0.0** (etiqueta conservada en Git); los cambios entre ambas están en [CHANGELOG.md](../CHANGELOG.md).

## Módulos incluidos

| Módulo | Funcionalidad | Desde |
|---|---|---|
| Autenticación | Inicio y cierre de sesión; roles cliente, mesero y administrador; verificación del rol en el servidor | v1.0.0 |
| Menú digital | CRUD de categorías y platos; menú público con platos disponibles | v1.0.0 |
| Pedidos | Registro por mesa; seguimiento de estados; tablero **en tiempo real** por eventos | v1.0.0 (tiempo real en v1.1.0) |
| Reservas | Reserva por fecha, hora y personas; asignación de mesa por capacidad y duración | v1.0.0 |
| Facturación | Factura académica persistida al cobrar un pedido | v1.1.0 |
| Caja | Cierre diario por jornada (hora de Bogotá) y turno; reportes por jornada | v1.0.0 (jornadas en v1.1.0) |

## Pedidos en tiempo real

- El tablero (`/pedidos`) abre un canal **Server-Sent Events** en `GET /api/pedidos/eventos`.
- **Autorización en el servidor antes de enviar datos:** sin sesión → 401; rol distinto de mesero o administrador → 403. En ambos casos la respuesta es un JSON de error, sin datos de pedidos.
- Al conectar, el servidor envía una instantánea de los pedidos en curso. Después envía una nueva cada vez que un pedido se **crea**, **cambia de estado**, se **cancela** o se **factura**.
- Al abrir, el servidor informa su intervalo de latido (evento `conexion`).
- Cada `SSE_LATIDO_MS` (15 s por defecto) envía el evento `latido` y **vuelve a verificar** la sesión y el rol en la base de datos. Si el usuario perdió el permiso, envía `cierre` (`SIN_AUTORIZACION`) y cierra el canal.
- Cada `SSE_DURACION_MAX_MS` (10 min por defecto) el servidor cierra la conexión (`cierre`/`RENOVAR`). El navegador se reconecta, lo que obliga a reautorizar.
- **Desconexión y reconexión en el navegador:**
  - Si la red falla, el navegador reintenta solo y el indicador muestra «reconectando».
  - **Corte silencioso** (la conexión parece abierta pero no llegan datos, por ejemplo por una red caída sin aviso o un proxy que retiene la respuesta): si pasan 2,5 latidos sin ningún evento (37,5 s con la configuración por defecto; mínimo 5 s), el cliente cierra la conexión y reintenta.
  - Si la conexión queda cerrada, el cliente reintenta con espera exponencial (1 s, 2 s, 4 s… hasta 30 s). Antes de cada intento verifica el acceso; con 401 o 403 deja de insistir y lo indica.
  - Al volver la red (evento `online`) reintenta de inmediato.
  - Al reconectar recibe una instantánea completa, así que **no se pierden cambios** ocurridos durante el corte.
- **Cierre:** al salir de la página, el cliente cierra el canal. El servidor detecta la desconexión y libera la suscripción y los temporizadores.
- **Cómo se prueba:**
  - Las pruebas de unidad cubren con un EventSource simulado la reconexión, la espera exponencial, el corte silencioso y la falta de permiso.
  - Las de integración usan el canal real: dos sesiones, 401/403 sin datos, pérdida de permiso durante la conexión, renovación y liberación al desconectar.
  - Las E2E usan Chromium con dos sesiones, un usuario sin permiso, la renovación periódica y la caída de red.
  - Nota sobre la caída de red: el modo sin conexión de Chromium bloquea las conexiones nuevas, pero no corta una conexión local ya abierta. Por eso la prueba la combina con la renovación periódica: el reintento falla mientras no hay red y se completa al volver, con recuperación de los cambios ocurridos.
- **Limitación:** el bus de eventos vive en memoria del proceso. Funciona con una sola instancia de la aplicación, igual que SQLite. Varias instancias requerirían un bus compartido, por ejemplo Redis.

## Facturación

### Qué es

- La **factura académica de venta** se genera al cobrar un pedido y se guarda en la base de datos (`facturas` y `factura_items`).
- **No es una factura electrónica de venta.** La guía del curso menciona facturación, pero no exige factura electrónica. En Colombia esta debe cumplir los requisitos de la DIAN: resolución de numeración, CUFE, firma digital, XML UBL y validación previa. Esa integración queda fuera del alcance.

### Contenido

| Campo | Origen |
|---|---|
| Número único | Consecutivo con prefijo (`FA-000001`), con restricción `UNIQUE` en la BD |
| Fecha y hora de emisión | Servidor |
| Emisor: razón social, NIT, dirección, teléfono | Configuración del restaurante (valores ficticios, configurables por entorno) |
| Cliente | «Consumidor final» o, si se identifica: tipo y número de documento, nombre o razón social y correo opcional |
| Detalle | Descripción, cantidad, valor unitario y valor total de cada producto, tomados del pedido |
| Subtotal (base), impuesto al consumo (8 % incluido en precios) y total | Calculados en el servidor |
| Medio de pago, mesa, jornada de caja | Formulario, pedido y servidor |

### Reglas

- El formulario solo envía el medio de pago y los datos del cliente. **Ningún valor monetario viene del navegador.**
- **Datos históricos:** la factura guarda una copia del emisor, del cliente y del detalle. Cambiar después el menú (nombre o precio) o los datos del restaurante no altera facturas ya emitidas.
- **Un pedido se factura una sola vez**, y esto se garantiza en tres niveles:
  1. La regla de negocio rechaza un pedido ya facturado.
  2. Las escrituras se serializan en el proceso, así que dos solicitudes simultáneas no se cruzan.
  3. `pedido_id` es `UNIQUE` en la tabla de facturas.
- Solo se facturan pedidos en estado **ENTREGADO**.
- No hay anulación ni notas crédito; quedan como solicitud de cambio. Una factura emitida no se modifica.

### Relación con los demás módulos

```
Pedido ENTREGADO ──(cobro)──► Factura FA-n ──► pedido PAGADO
                                 │
                                 ├─► jornada (día en Bogotá) ──► Cierre de caja (jornada, turno)
                                 └─► Reportes (ventas por jornada, productos más vendidos)
```

| Relación | Regla |
|---|---|
| Pedidos | Un pedido tiene como máximo una factura. Facturar es la única forma de pasarlo a PAGADO. |
| Cobros | Emitir la factura **es** el registro del cobro: en la misma transacción se guarda la factura con su medio de pago y el pedido pasa a PAGADO. No hay pagos parciales. |
| Caja | Cada factura pertenece a una jornada y queda pendiente hasta que un cierre la incluya. |
| Reportes | Las ventas y los productos más vendidos se calculan desde las facturas y su detalle copiado, no desde el menú actual. |
| v1.0.0 | Los comprobantes internos existentes se convirtieron en facturas al migrar, conservando número, total, detalle y cierre. El medio de pago queda como «No registrado». |

## Cierre diario de caja

- **Corte:** la **jornada** es el día calendario en **hora de Bogotá** (00:00:00 a 23:59:59, UTC-5, sin horario de verano). Cada factura recibe su jornada al emitirse y nunca cambia.
- **Turnos:** cada cierre pertenece a una jornada y recibe el siguiente número de turno (1, 2…). La combinación (jornada, turno) es única en la base de datos.
- **Separación de jornadas:** un cierre incluye **solo** las facturas pendientes de su jornada. Si quedó sin cerrar una jornada anterior, aparece aparte en la caja, marcada, y se cierra por separado.
- **Inmutabilidad:**
  - El cierre guarda fecha y hora, responsable, total y cantidad de facturas, y deja las facturas asociadas a él.
  - Una venta posterior en la misma jornada queda pendiente para el **turno siguiente**. Los cierres anteriores no cambian.
- No se pueden cerrar jornadas futuras ni una jornada sin facturas pendientes.
- **Reporte por jornada:** facturas, turnos cerrados, valor cerrado, valor pendiente y total.
- **Cierres heredados de v1.0.0:** reciben como jornada el día (hora de Bogotá) en que se hicieron. En esa versión un cierre podía agrupar ventas de varios días; esos registros se conservan sin modificar.

## Excluido (posibles solicitudes de cambio)

- Facturación electrónica DIAN, anulaciones y notas crédito.
- Pagos en línea, pagos parciales y propinas.
- Notificaciones (correo, WhatsApp, push).
- Bus de eventos compartido para varias instancias.
- Registro de usuarios y gestión de mesas desde la interfaz.
- Motor de base de datos cliente-servidor.
- Integración continua (unidad 3).
