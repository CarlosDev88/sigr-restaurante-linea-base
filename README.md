# SIGR – Sistema Integral de Gestión de Restaurante

Aplicación web para gestionar la operación de un restaurante: autenticación por roles, menú digital, pedidos con seguimiento, reservas, comprobantes internos, cierre de caja y reportes de ventas.

Este repositorio contiene la **línea base v1.0.0** (etiqueta Git `v1.0.0`), primer hito estable del proyecto. Los cambios posteriores se registran en [CHANGELOG.md](CHANGELOG.md).

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
| `npm run db:generate` | Genera una nueva migración SQL a partir de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga datos de prueba |
| `npm run db:reset` | Borra la BD local y la recrea con datos de prueba |

## Módulos

| Módulo | Ruta | Roles |
|---|---|---|
| Autenticación | `/login` | Todos |
| Menú público | `/menu` | Público |
| Administración del menú (CRUD) | `/admin/menu` | Administrador |
| Pedidos (registro y seguimiento) | `/pedidos`, `/pedidos/nuevo` | Mesero, Administrador |
| Reservas del cliente | `/reservas` | Cliente |
| Gestión de reservas | `/admin/reservas` | Administrador |
| Comprobantes | `/comprobantes/[numero]` | Mesero, Administrador |
| Caja y cierres | `/caja` | Administrador |
| Reportes de ventas | `/caja/reportes` | Administrador |

## Estructura de carpetas

```
sigr/
├── drizzle/                 Migraciones SQL versionadas
├── docs/                    Documentación técnica
├── scripts/                 migrar.ts y seed.ts
├── src/
│   ├── app/                 Páginas, Server Actions (actions.ts) y API (api/)
│   ├── components/          Componentes compartidos
│   ├── lib/
│   │   ├── auth/            Sesión, token y permisos
│   │   ├── db/              Esquema y cliente de base de datos
│   │   ├── domain/          Constantes y reglas de negocio puras
│   │   └── services/        Lógica de cada módulo (usa la BD)
│   └── proxy.ts             Verificación optimista de sesión
└── tests/
    ├── unit/                Reglas, autorización y verificación estática
    ├── integracion/         Servicios contra una BD SQLite de pruebas
    └── e2e/                 Playwright
```

## Convenciones

- Código e identificadores en español para el dominio (pedido, reserva, comprobante) y en inglés para la plataforma (props, hooks).
- Toda página protegida, Server Action y Route Handler valida el rol en el servidor con `exigirRol()` o `autorizar()`. Una prueba automática (`tests/unit/autorizacion-en-servidor.test.ts`) lo verifica.
- Las reglas de negocio viven en `src/lib/services` y `src/lib/domain`, no en los componentes.
- Montos en pesos colombianos enteros (COP). Fechas guardadas en UTC y mostradas en hora de Bogotá (UTC-5).
- Commits con el formato *Conventional Commits* (`feat`, `fix`, `test`, `docs`, `chore`). Ramas `feature/*` integradas a `main` con merge sin avance rápido (`--no-ff`).

## Documentación

- [Estructura de la base de datos](docs/estructura-bd.md)
- [Manual de despliegue](docs/despliegue.md)
- [Alcance de la línea base](docs/alcance.md)
- [Decisiones técnicas](docs/decisiones.md)

## Licencia

MIT. Ver [LICENSE.txt](LICENSE.txt).
