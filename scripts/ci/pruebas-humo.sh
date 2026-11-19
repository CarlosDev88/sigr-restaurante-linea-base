#!/usr/bin/env bash
# Pruebas de humo contra un entorno desplegado. Uso: pruebas-humo.sh http://localhost:3000
# Verifica que la aplicación responde y que la seguridad básica está activa.
set -uo pipefail
BASE="${1:-http://localhost:3000}"
fallas=0

verificar() { # descripción, código esperado, ruta, [texto esperado en la respuesta]
  local desc="$1" esperado="$2" ruta="$3" texto="${4:-}"
  local cuerpo codigo
  cuerpo=$(mktemp)
  codigo=$(curl -s -o "$cuerpo" -w "%{http_code}" "$BASE$ruta")
  if [[ "$codigo" == "$esperado" ]] && { [[ -z "$texto" ]] || grep -q "$texto" "$cuerpo"; }; then
    echo "OK    $desc ($ruta → $codigo)"
  else
    echo "FALLA $desc ($ruta → $codigo, esperado $esperado${texto:+ con \"$texto\"})"
    fallas=$((fallas + 1))
  fi
  rm -f "$cuerpo"
}

verificar "Salud de la aplicación y la BD" 200 /api/salud '"baseDeDatos":"ok"'
verificar "Menú público con datos"          200 /menu "Bandeja paisa"
verificar "Página de inicio de sesión"       200 /login "Iniciar sesión"
verificar "Tablero protegido redirige"       307 /pedidos
verificar "API de pedidos exige sesión"      401 /api/pedidos "No autenticado"
verificar "Canal de eventos exige sesión"    401 /api/pedidos/eventos "No autenticado"
verificar "Caja protegida redirige"          307 /caja

echo
if (( fallas > 0 )); then echo "$fallas prueba(s) de humo fallaron"; exit 1; fi
echo "Todas las pruebas de humo pasaron"
