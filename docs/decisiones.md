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

## D5. Actualización del tablero por consulta periódica

**Decisión:** consulta cada 5 s (ver [alcance.md](alcance.md#actualización-de-pedidos)). La demora es acotada, no requiere infraestructura adicional y está probada.

## D6. Comprobante interno, no factura electrónica

**Decisión:** ver [alcance.md](alcance.md#comprobante-interno-frente-a-factura-electrónica).

## D7. Estrategia de pruebas

- **Vitest:** reglas de dominio puras, autorización y servicios contra una base SQLite de pruebas (`data/test.db`) creada con las mismas migraciones.
- **Playwright:** la documentación de Next.js recomienda pruebas de extremo a extremo para Server Components asíncronos. Se ejecutan contra la aplicación compilada con su propia base de datos (`data/e2e.db`).

## D8. Gestión de la configuración

- Rama estable `main`. Cada módulo se desarrolla en una rama `feature/*` y se integra con `--no-ff`, para que el historial muestre cada integración.
- Commits con formato *Conventional Commits*.
- La línea base se marca con la etiqueta anotada `v1.0.0`, creada solo después de que pasan lint, tipos, pruebas unitarias e integración, compilación y E2E.
