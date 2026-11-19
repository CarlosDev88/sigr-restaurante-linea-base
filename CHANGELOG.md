# Changelog

Todos los cambios relevantes del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

Nada todavía.

## [1.2.0] - 2026-11-19 — Pipeline CI/CD

### Agregado

- **Pipeline CI/CD en GitHub Actions** (`.github/workflows/ci-cd.yml`), con 8 etapas encadenadas:
  1. Validación estática: lint, tipos y migraciones.
  2. Pruebas unitarias e integración, con umbral de cobertura.
  3. Seguridad de dependencias.
  4. Construcción.
  5. E2E con Playwright.
  6. Imagen Docker con escaneo Grype y publicación en GHCR.
  7. Staging: despliegue, pruebas de humo y carga con k6.
  8. Producción: promoción de la misma imagen, con aprobación.
- Análisis estático de seguridad con **CodeQL** (`.github/workflows/codeql.yml`) y **Dependabot** para npm, GitHub Actions y Docker.
- **Dockerfile** multietapa: dependencias de producción, sin npm en la imagen final, usuario sin privilegios y `HEALTHCHECK`. Script `docker/entrypoint.sh`, que migra, carga datos opcionales e inicia la aplicación.
- Endpoint público **`GET /api/salud`**: estado de la aplicación y de la BD, versión y commit; 503 si la BD no responde.
- Scripts del pipeline: `scripts/ci/esperar-salud.sh` y `scripts/ci/pruebas-humo.sh`. Prueba de carga `tests/carga/staging.js`.
- Umbrales de cobertura en Vitest: líneas y sentencias 80 %, ramas y funciones 70 %.
- Plantilla de pull request. Documento [docs/pipeline.md](docs/pipeline.md).

### Cambiado

- **Next.js 16.4.4 → 16.4.6** y `eslint-config-next` 16.4.6. Corrige los avisos GHSA-mfr8-8qww-v76h y GHSA-vc7v-qv4w-wrv8: `next build` se negó a compilar con la versión anterior.
- `npm audit fix`: ESLint y sus complementos quedan sin avisos. La auditoría completa termina con 0 vulnerabilidades.
- Pruebas E2E: en el pipeline reutilizan la compilación de la etapa 4 (`E2E_BUILD_LISTO=1`) y generan reporte JUnit.
- `scripts/migrar.ts` acepta `MIGRACIONES_DIR`, que usa la imagen Docker.
- Versión del paquete: 1.2.0.

## [1.1.0] - 2026-11-03 — Correcciones de auditoría

Versión posterior a la línea base. Atiende los hallazgos de la auditoría sobre pedidos en tiempo real, facturación y cierre diario de caja. La etiqueta `v1.0.0` se conserva sin cambios.

### Agregado

- **Pedidos en tiempo real** (`feature/pedidos-tiempo-real`):
  - Canal Server-Sent Events `GET /api/pedidos/eventos`. Responde 401/403 sin datos si la sesión o el rol no son válidos. Envía una instantánea inicial y otra con cada creación, cambio de estado o facturación.
  - El servidor reverifica sesión y rol en cada latido, renueva la conexión periódicamente y libera los recursos al desconectarse el cliente.
  - El cliente indica el estado de la conexión (en vivo, reconectando, sin permiso), reconecta con espera exponencial y verifica el acceso antes de reintentar.
  - El cliente detecta cortes silenciosos: si pasan 2,5 latidos sin eventos, cierra y reintenta.
- **Facturación** (`feature/facturacion`):
  - Factura académica persistida (`facturas`, `factura_items`) con número consecutivo único `FA-000001`, fecha, datos del emisor y del cliente (consumidor final o identificado), detalle, base, impuesto al consumo incluido (8 %), total calculado en el servidor y medio de pago.
  - Listado `/facturas` y detalle `/facturas/[numero]`.
  - No es factura electrónica DIAN.
- **Cierre diario** (`feature/cierre-diario`):
  - Jornada = día calendario en hora de Bogotá, asignada a cada factura.
  - Cierres por jornada y turno, con restricción única (jornada, turno). Una venta posterior a un cierre va al turno siguiente.
  - Reporte por jornada con valores cerrado y pendiente.
- Migraciones `0001`–`0006` con migración de datos desde v1.0.0 y su prueba.
- Script `npm run auditoria` y documento [docs/seguridad-dependencias.md](docs/seguridad-dependencias.md).
- Pruebas nuevas:
  - Unidad: conexión de eventos simulada.
  - Integración: canal de eventos, facturación, cierre por jornada, concurrencia y migraciones.
  - E2E: tiempo real entre dos sesiones, usuario sin permiso, renovación y caída de red; facturación con cliente y duplicados; turnos de cierre.

### Cambiado

- El cobro de un pedido emite una **factura** en lugar del comprobante interno, y en la misma transacción pasa el pedido a PAGADO.
- Caja y reportes se calculan sobre facturas y su detalle copiado.
- El tablero de pedidos ya no consulta cada 5 s; recibe eventos.
- Las escrituras sobre SQLite se serializan dentro del proceso para evitar `SQLITE_BUSY` con transacciones simultáneas.
- `overrides` de `esbuild@^0.25` para `drizzle-kit` (aviso GHSA-67mh-4wv8-2f99).
- Versión del paquete: 1.1.0.

### Eliminado

- Tabla `comprobantes` y ruta `/comprobantes/[numero]`. Los datos se migran a `facturas` conservando el número.
- Constante `INTERVALO_ACTUALIZACION_MS`, ya que no hay consulta periódica.

### Actualización

Respaldar `data/sigr.db` y ejecutar `npm ci && npm run db:migrate && npm run build`. Ver [docs/despliegue.md](docs/despliegue.md#4-actualización-desde-v100).

## [1.0.0] - 2026-11-03 — Línea base

Primera versión estable. Incluye los cambios integrados en `main` desde el commit inicial hasta la etiqueta `v1.0.0`.

### Agregado

- **Configuración** (`chore`): proyecto Next.js 16 con TypeScript, Tailwind 4, Drizzle ORM sobre SQLite, migración inicial versionada (`drizzle/0000_init.sql`), scripts de migración y datos de prueba.
- **Autenticación** (`feature/autenticacion`): inicio y cierre de sesión; roles cliente, mesero y administrador; sesión JWT firmada en cookie httpOnly; verificación del rol en cada página, Server Action y Route Handler; Proxy como verificación optimista.
- **Menú digital** (`feature/menu`): CRUD de categorías y platos (administrador) y menú público con platos disponibles. Un plato con pedidos no se elimina; se marca como no disponible.
- **Pedidos** (`feature/pedidos`): registro por mesa con copia del nombre y precio vigentes; estados pendiente → en preparación → entregado (o cancelado); tablero con actualización automática cada 5 segundos.
- **Reservas** (`feature/reservas`): reserva por fecha, hora y número de personas; asignación automática de mesa según capacidad y duración (120 min); confirmación y cancelación.
- **Caja** (`feature/caja`): cobro con comprobante interno consecutivo (número, detalle y total); cierre de caja guardado con fecha, responsable, total y cantidad de comprobantes; reporte de ventas por día y platos más vendidos.
- **Pruebas** (`feature/pruebas-e2e`): pruebas unitarias y de integración con Vitest; pruebas de extremo a extremo con Playwright; verificación automática de autorización en el servidor.
- **Documentación** (`docs/linea-base`): README, CHANGELOG, licencia, estructura de la base de datos, manual de despliegue, alcance y decisiones técnicas.

### Fuera del alcance de esta versión

- Facturación electrónica ante la DIAN (el comprobante es solo de control interno).
- Pagos en línea, notificaciones y actualización en tiempo real por WebSockets.
- Ver [docs/alcance.md](docs/alcance.md).

[Sin publicar]: ../../compare/v1.2.0...HEAD
[1.2.0]: ../../compare/v1.1.0...v1.2.0
[1.1.0]: ../../compare/v1.0.0...v1.1.0
[1.0.0]: ../../releases/tag/v1.0.0
