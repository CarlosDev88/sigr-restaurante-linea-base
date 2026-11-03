# Changelog

Todos los cambios relevantes del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

Nada todavía. Los cambios posteriores a la línea base se registran aquí y se tramitan como solicitudes de cambio (GitHub Issues).

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

[Sin publicar]: ../../compare/v1.0.0...HEAD
[1.0.0]: ../../releases/tag/v1.0.0
