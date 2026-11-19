#!/bin/sh
# Arranque del contenedor SIGR: aplica migraciones, carga datos de demostración (opcional) e inicia Next.js.
set -e
node dist/scripts/migrar.js
if [ "${SEMBRAR_DATOS_DEMO:-0}" = "1" ]; then
  node dist/scripts/seed.js
fi
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
