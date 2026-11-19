# SIGR – Sistema Integral de Gestión de Restaurante

[![CI/CD SIGR](https://github.com/CarlosDev88/sigr-restaurante-linea-base/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/CarlosDev88/sigr-restaurante-linea-base/actions/workflows/ci-cd.yml)
[![CodeQL](https://github.com/CarlosDev88/sigr-restaurante-linea-base/actions/workflows/codeql.yml/badge.svg)](https://github.com/CarlosDev88/sigr-restaurante-linea-base/actions/workflows/codeql.yml)

Aplicación web para gestionar la operación de un restaurante: autenticación por roles, menú digital, pedidos en tiempo real, reservas, facturación académica, cierre diario de caja y reportes de ventas.

Versión actual: **v1.2.0**, que agrega el pipeline CI/CD, la imagen Docker y la verificación de salud. Versiones anteriores: `v1.1.0` (correcciones de auditoría) y la **línea base** `v1.0.0`, que se conserva sin cambios. Las diferencias están en [CHANGELOG.md](CHANGELOG.md).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Framework (front y back) | Next.js 16 (App Router, Server Actions, Route Handlers) + React 19 |
| Lenguaje | TypeScript 5 |
| Base de datos | SQLite (archivo local) con Drizzle ORM y cliente libsql |
| Autenticación | Sesión JWT firmada (jose) en cookie httpOnly; contraseñas con bcrypt |
| Validación | Zod |
| Estilos | Tailwind CSS 4 |
| Pruebas | Vitest (reglas e integración con BD) y Playwright (extremo a extremo) |
| Calidad | ESLint (configuración de Next.js), TypeScript estricto |

## Requisitos

- Node.js 20.9 o superior (probado con Node 22)
- npm 10 o superior
- Git

## Instalación y ejecución

```bash
git clone <url-del-repositorio> sigr
cd sigr
npm install
cp .env.example .env        # en Windows (cmd): copy .env.example .env
npm run setup               # crea data/sigr.db, aplica migraciones y carga datos de prueba
npm run dev                 # http://localhost:3000
```

### Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@sigr.local | Admin123* |
| Mesero | mesero@sigr.local | Mesero123* |
| Cliente | cliente@sigr.local | Cliente123* |

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y ejecución de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos |
| `npm test` | Pruebas unitarias y de integración (Vitest) |
| `npm run test:coverage` | Pruebas con reporte de cobertura |
| `npm run test:e2e` | Pruebas de extremo a extremo (Playwright; la primera vez: `npx playwright install chromium`) |
| `npm run verificar` | lint + tipos + pruebas + compilación (criterio de la línea base) |
| `npm run build:scripts` | Empaqueta los scripts de migración y de datos iniciales para la imagen Docker |
| `npm run test:carga` | Prueba de carga con k6 contra `BASE_URL` (ver [docs/pipeline.md](docs/pipeline.md)) |
| `npm run auditoria` | Revisión de dependencias con `npm audit` (ver [docs/seguridad-dependencias.md](docs/seguridad-dependencias.md)) |
| `npm run db:generate` | Genera una nueva migración SQL a partir de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos de prueba |
| `npm run db:reset` | Borra la BD local y la recrea con datos de prueba |

## Pipeline CI/CD y Docker

Cada push y cada PR ejecutan en GitHub Actions estas etapas, en orden:

1. Validación estática.
2. Pruebas unitarias y de integración.
3. Seguridad de dependencias.
4. Construcción.
5. Pruebas E2E.
6. Imagen Docker con escaneo.

Además:

- **Merge a `main`:** despliega en un *staging* efímero con pruebas de humo y de carga.
- **Etiqueta `v*`:** promueve la imagen a producción, previa aprobación.

Detalle en [docs/pipeline.md](docs/pipeline.md).

```bash
docker build -t sigr:local .
docker run -d -p 3000:3000 -e SESSION_SECRET=<clave-de-32-o-mas-caracteres> -e SEMBRAR_DATOS_DEMO=1 -e COOKIE_SEGURA=false sigr:local
curl http://localhost:3000/api/salud
```

## Módulos

| Módulo | Ruta | Roles |
|---|---|---|
| Autenticación | `/login` | Todos |
| Menú público | `/menu` | Público |
| Administración del menú (CRUD) | `/admin/menu` | Administrador |
| Pedidos (registro y seguimiento en tiempo real) | `/pedidos`, `/pedidos/nuevo`, eventos en `/api/pedidos/eventos` | Mesero, Administrador |
| Reservas del cliente | `/reservas` | Cliente |
| Gestión de reservas | `/admin/reservas` | Administrador |
| Facturación (cobro) | `/pedidos/[id]/facturar`, `/facturas`, `/facturas/[numero]` | Mesero, Administrador |
| Caja: cierre diario por jornada y turno | `/caja` | Administrador |
| Reportes de ventas por jornada | `/caja/reportes` | Administrador |

## Estructura de carpetas

```
sigr/
├── drizzle/                 Migraciones SQL versionadas
├── .github/                 Workflows de GitHub Actions (CI/CD, CodeQL), Dependabot y plantilla de PR
├── docker/                  Script de arranque del contenedor
├── docs/                    Documentación técnica
├── scripts/                 migrar.ts, seed.ts y scripts del pipeline (ci/)
├── src/
│   ├── app/                 Páginas, Server Actions (actions.ts) y API (api/)
│   ├── components/          Componentes compartidos
│   ├── lib/
│   │   ├── auth/            Sesión, token y permisos
│   │   ├── db/              Esquema y cliente de base de datos
│   │   ├── domain/          Constantes, reglas de negocio puras y datos del restaurante
│   │   ├── eventos/         Bus de eventos y utilidades SSE (pedidos en tiempo real)
│   │   └── services/        Lógica de cada módulo (usa la BD)
│   └── proxy.ts             Verificación optimista de sesión
└── tests/
    ├── unit/                Reglas, autorización y verificación estática
    ├── integracion/         Servicios contra una BD SQLite de pruebas
    └── e2e/                 Playwright
```

## Convenciones

- Código e identificadores en español para el dominio (pedido, reserva, factura) y en inglés para la plataforma (props, hooks).
- Toda página protegida, Server Action y Route Handler valida el rol en el servidor con `exigirRol()` o `autorizar()`. Una prueba automática (`tests/unit/autorizacion-en-servidor.test.ts`) lo verifica.
- Las reglas de negocio viven en `src/lib/services` y `src/lib/domain`, no en los componentes.
- Montos en pesos colombianos enteros (COP). Fechas guardadas en UTC y mostradas en hora de Bogotá (UTC-5).
- Commits con el formato *Conventional Commits* (`feat`, `fix`, `test`, `docs`, `chore`). Ramas `feature/*` integradas a `main` con merge sin avance rápido (`--no-ff`).

## Documentación

- [Estructura de la base de datos](docs/estructura-bd.md)
- [Manual de despliegue](docs/despliegue.md)
- [Alcance funcional (pedidos en tiempo real, facturación, cierre diario)](docs/alcance.md)
- [Decisiones técnicas](docs/decisiones.md)
- [Seguridad de dependencias](docs/seguridad-dependencias.md)
- [Pipeline CI/CD](docs/pipeline.md)

## Licencia

MIT. Ver [LICENSE.txt](LICENSE.txt).
