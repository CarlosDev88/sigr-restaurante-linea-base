# Revisión de seguridad de dependencias

Revisión hecha con `npm audit` (registro público de npm) sobre `package-lock.json` de la versión **v1.1.0**, en un clon limpio. Los registros completos están en la carpeta de evidencias (`11-npm-audit*.txt`/`.json`). Comando reproducible: `npm run auditoria`.

## Resumen

| Alcance | Crítica | Alta | Moderada | Baja |
|---|---|---|---|---|
| **Dependencias de producción** (`--omit=dev`): lo que se ejecuta en el servidor | 0 | 0 | 0 | 0 |
| Dependencias de desarrollo: herramientas de lint, migración y pruebas | 0 | 0 | 16 | 0 |

## Hallazgos y tratamiento

| # | Aviso | Paquete y ruta | Severidad | Tratamiento |
|---|---|---|---|---|
| 1 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99): el servidor de desarrollo de esbuild permite que un sitio externo lea sus respuestas | `esbuild` ≤ 0.24.2, vía `drizzle-kit` → `@esbuild-kit/core-utils` | Moderada | **Mitigado.** `overrides` en `package.json` fuerza `esbuild@^0.25` para `@esbuild-kit/core-utils`. Se comprobó que `drizzle-kit generate` y `drizzle-kit check` siguen funcionando. Además, SIGR no usa el servidor de desarrollo de esbuild. Con esto se eliminaron 4 de los 20 avisos iniciales. |
| 2 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): posible denegación de servicio en `minimatch` con patrones glob maliciosos | `minimatch` < 11.0.1, vía `eslint` 9, `eslint-config-next` 16.4.4 y sus plugins (16 entradas en el informe; la causa raíz es una sola) | Moderada | **Riesgo aceptado (solo desarrollo).** ESLint solo procesa patrones definidos en el propio repositorio, no entradas de usuarios, y no forma parte de la aplicación desplegada. La corrección que propone `npm audit fix --force` es un *downgrade* incompatible (`eslint@4`, `eslint-config-next@0.2.4`), por eso no se aplica. Se revisará cuando ESLint y `eslint-config-next` publiquen versiones con `minimatch` ≥ 11.0.1. |

## Otras verificaciones relacionadas

- No hay secretos en el repositorio: `.env*` está en `.gitignore`, salvo `.env.example`, que solo tiene valores de ejemplo.
- Contraseñas con hash bcrypt (`bcryptjs`, costo 10).
- La sesión es un JWT HS256 en una cookie `httpOnly`, `SameSite=Lax` y `Secure` en producción.
- Toda página protegida, Server Action y Route Handler (incluido el canal de eventos) verifica el rol en el servidor. Lo comprueba automáticamente `tests/unit/autorizacion-en-servidor.test.ts`.

## Procedimiento para futuras versiones

1. Ejecutar `npm run auditoria`. Falla si hay hallazgos en producción o hallazgos altos o críticos en cualquier dependencia.
2. Registrar en este documento los hallazgos nuevos y su tratamiento: corregido, mitigado o aceptado con justificación.
3. Guardar la salida de `npm audit` en la carpeta de evidencias de la versión.
