# Decisiones técnicas

Registro breve de las decisiones tomadas para la línea base (formato ADR simplificado).

## D1. Next.js para front y back en un solo repositorio

**Contexto:** se necesita una aplicación web con interfaz y lógica de servidor, versionada como una sola unidad de configuración.
**Decisión:** Next.js 16 (App Router). Las páginas son Server Components, las mutaciones usan Server Actions y el tablero de pedidos consulta un Route Handler (`/api/pedidos`).
**Consecuencia:** una sola tecnología (TypeScript) y un solo repositorio, de modo que la línea base cubre todo el sistema.

## D2. SQLite con Drizzle ORM en lugar de Prisma

**Contexto:** el plan inicial era usar Prisma. Durante la construcción, el entorno de compilación bloqueó la descarga de los motores binarios de Prisma (`binaries.prisma.sh`), que se necesitan para las migraciones.
**Decisión:** Drizzle ORM con el cliente `@libsql/client`. Se instala por completo desde npm, funciona igual en Windows, macOS y Linux, y genera migraciones SQL legibles (`drizzle/*.sql`).
**Consecuencia:** el esquema y las migraciones quedan versionados como archivos de texto dentro de la línea base.

## D3. La autorización se verifica en el servidor, en cada operación

**Contexto:** según la guía de autenticación de Next.js, el Proxy (antes Middleware) sirve como verificación optimista y no basta por sí solo. Cada Server Action es un punto de entrada público y debe verificar permisos.
**Decisión:**
- `src/proxy.ts` solo redirige a `/login` cuando no hay sesión válida.
- `exigirRol()` se llama al inicio de cada página protegida y de cada Server Action.
- El Route Handler usa `autorizar()` y responde 401 o 403.
- El rol se vuelve a leer de la base de datos en cada solicitud.
- La prueba `tests/unit/autorizacion-en-servidor.test.ts` falla si una acción, página o handler omite la verificación.

## D4. `cacheComponents` desactivado

**Contexto:** `create-next-app` 16.4 activa `cacheComponents` por defecto. Todas las vistas protegidas leen la sesión, y pedidos y caja deben mostrar datos actuales.
**Decisión:** no activar `cacheComponents` en la línea base. Todas las rutas se renderizan por solicitud.
**Consecuencia:** el comportamiento es más simple y predecible. Se puede reevaluar como optimización futura.

## D5. Pedidos en tiempo real con Server-Sent Events (v1.1.0; reemplaza la consulta periódica de v1.0.0)

**Contexto:** la auditoría pidió que los cambios de pedidos se vieran en otra sesión sin recargar, con autorización en el servidor y manejo de desconexión. La v1.0.0 consultaba cada 5 s.
**Decisión:**
- **Server-Sent Events** (`/api/pedidos/eventos`) y bus de eventos en memoria. El flujo es solo del servidor al navegador, funciona sobre HTTP normal, el navegador reconecta solo y Next.js lo soporta en un Route Handler sin servidor adicional. WebSockets no aporta nada aquí, porque las acciones ya viajan por Server Actions.
- El canal envía **instantáneas completas** en lugar de diferencias. Así, una reconexión recupera el estado completo sin perder cambios.
- La autorización ocurre antes de abrir el canal y se repite en cada latido y en cada renovación de la conexión.
**Consecuencia:** latencia de menos de 1 s en local, frente a hasta 5 s antes. Funciona con una sola instancia del servidor (ver [alcance.md](alcance.md#pedidos-en-tiempo-real)).

## D6. Factura académica persistida (v1.1.0; reemplaza el comprobante interno de v1.0.0)

**Contexto:** la guía del curso menciona facturación; la auditoría pidió una factura persistida con número único, emisor, cliente, detalle y total calculado en el servidor.
**Decisión:**
- Las tablas `facturas` y `factura_items` guardan una copia de todos los datos, para conservar el historial.
- Emitir la factura registra el cobro.
- Los comprobantes de v1.0.0 se migran a facturas en lugar de convivir con ellas, para que exista un solo documento de venta.
- No es factura electrónica DIAN (ver [alcance.md](alcance.md#facturación)).

## D7. Estrategia de pruebas

- **Vitest:** reglas de dominio puras, autorización y servicios contra una base SQLite de pruebas (`data/test.db`) creada con las mismas migraciones.
- **Playwright:** la documentación de Next.js recomienda pruebas de extremo a extremo para Server Components asíncronos. Se ejecutan contra la aplicación compilada con su propia base de datos (`data/e2e.db`).
  - En v1.1.0 incluyen dos sesiones simultáneas, un usuario sin permiso frente al canal de eventos, la renovación de la conexión (`SSE_DURACION_MAX_MS=4000`) y una caída de red simulada con `setOffline`, que bloquea las reconexiones (ver [alcance.md](alcance.md#pedidos-en-tiempo-real)).
  - La detección de cortes silenciosos se prueba con temporizadores simulados en `tests/unit/conexion-eventos.test.ts`.
- **Migraciones:** una prueba aplica el esquema v1.0.0 con datos y luego las migraciones nuevas.

## D8. Gestión de la configuración

- Rama estable `main`. Cada módulo se desarrolla en una rama `feature/*` y se integra con `--no-ff`, para que el historial muestre cada integración.
- Commits con formato *Conventional Commits*.
- La línea base se marca con la etiqueta anotada `v1.0.0`, creada solo después de que pasan lint, tipos, pruebas unitarias e integración, compilación y E2E.
- Los cambios posteriores se integran por ramas y se publican como una nueva versión etiquetada: `v1.1.0` (SemVer *minor*, porque agrega funcionalidad). La etiqueta `v1.0.0` no se mueve ni se reescribe.
- La etiqueta solo se crea después de ejecutar, en un clon limpio, todas las verificaciones y la auditoría de dependencias. Los registros se guardan como evidencia.

## D9. Cierre diario por jornada en hora de Bogotá y turnos (v1.1.0)

**Contexto:** en v1.0.0 un cierre agrupaba todo lo pendiente sin distinguir días.
**Decisión:**
- Jornada = día calendario en `America/Bogota`, calculada al emitir y guardada en la factura. Así no depende de la zona horaria del servidor.
- Se permiten varios cierres (turnos) por jornada, en lugar de bloquear ventas después del cierre. El restaurante puede seguir vendiendo y cerrar de nuevo.
- Cada cierre se limita a una jornada.

## D10. Escrituras serializadas sobre SQLite (v1.1.0)

**Contexto:** la prueba de facturas simultáneas reveló `SQLITE_BUSY`. Una transacción mantiene el bloqueo de escritura entre `await`s, y otra escritura en ese momento falla. Con `busy_timeout`, el problema es otro: como el motor es síncrono, se bloquea todo el event loop.
**Decisión:** `src/lib/db/cliente.ts` envuelve el cliente libsql con un cerrojo asíncrono. Las transacciones y escrituras del proceso esperan su turno en orden y las lecturas no esperan. Lo prueba `tests/integracion/concurrencia-bd.test.ts`.

## D11. Hallazgos de seguridad en dependencias (v1.1.0)

Ver [seguridad-dependencias.md](seguridad-dependencias.md).
