#!/usr/bin/env bash
# Espera a que /api/salud responda 200 (máximo ~60 s). Uso: esperar-salud.sh http://localhost:3000
set -euo pipefail
BASE="${1:-http://localhost:3000}"
for i in $(seq 1 30); do
  if curl -fsS "$BASE/api/salud" > /dev/null 2>&1; then
    echo "Aplicación disponible tras $((i * 2)) s:"
    curl -fsS "$BASE/api/salud"; echo
    exit 0
  fi
  sleep 2
done
echo "La aplicación no respondió en $BASE/api/salud" >&2
exit 1
