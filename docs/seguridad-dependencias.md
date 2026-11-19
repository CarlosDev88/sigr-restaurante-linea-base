# Revisión de seguridad de dependencias

Comando reproducible: `npm run auditoria`. El pipeline lo ejecuta en cada push y cada PR (etapa 3), así que este registro se mantiene con cada versión.

## Estado actual (v1.2.0)

| Alcance | Crítica | Alta | Moderada | Baja |
|---|---|---|---|---|
| Dependencias de producción (`--omit=dev`) | 0 | 0 | 0 | 0 |
| Todas las dependencias | 0 | 0 | 0 | 0 |

Controles automáticos adicionales del pipeline:

- Revisión de dependencias nuevas en cada PR (`dependency-review-action`, falla con severidad alta).
- Escaneo de la imagen Docker con Grype (falla con vulnerabilidades críticas corregibles).
- CodeQL sobre el código.
- Dependabot semanal.

## Historial de hallazgos y tratamiento

| Versión | Aviso | Paquete | Severidad | Tratamiento |
|---|---|---|---|---|
| v1.1.0 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): el servidor de desarrollo de esbuild permite lecturas desde otros sitios | `esbuild` ≤ 0.24.2, vía `drizzle-kit` | Moderada | **Mitigado.** `overrides` fuerza `esbuild@^0.25`. Se comprobó que `drizzle-kit generate` y `check` siguen funcionando. |
| v1.1.0 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): posible denegación de servicio en `minimatch` | `minimatch`, vía ESLint (solo desarrollo) | Moderada | En v1.1.0 se aceptó el riesgo, porque solo afectaba herramientas de desarrollo. **Corregido en v1.2.0** con `npm audit fix` (sin cambios incompatibles). |
| v1.2.0 | [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) y [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8): fuga de información entre valores de *root params* en funciones `use cache` | `next` 16.2.0–16.4.4 (**producción**) | Moderada | **Corregido:** actualización a `next@16.4.6`. SIGR no usa `use cache`, pero la versión afectada hacía fallar `next build` y la auditoría de producción, así que se actualizó. |

## Otras verificaciones relacionadas

- No hay secretos en el repositorio: `.env*` está en `.gitignore`, salvo `.env.example`, que solo tiene valores de ejemplo.
- Contraseñas con hash bcrypt (`bcryptjs`, costo 10).
- La sesión es un JWT HS256 en una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción.
- Toda página protegida, Server Action y Route Handler (incluido el canal de eventos) verifica el rol en el servidor. Lo comprueba automáticamente `tests/unit/autorizacion-en-servidor.test.ts`.

## Procedimiento para futuras versiones

1. Ejecutar `npm run auditoria`. Falla si hay hallazgos en producción o hallazgos altos o críticos en cualquier dependencia.
2. Registrar en este documento los hallazgos nuevos y su tratamiento: corregido, mitigado o aceptado con justificación.
3. Guardar la salida de `npm audit` en la carpeta de evidencias de la versión.
