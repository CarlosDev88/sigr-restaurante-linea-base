# Manual de despliegue

Aplica a la versión **v1.1.0**. Para desplegar la línea base original use la etiqueta `v1.0.0`.

## 1. Requisitos

- Node.js 20.9 o superior y npm.
- Acceso de escritura a la carpeta del proyecto (SQLite crea `data/sigr.db`).
- **Una sola instancia** de la aplicación (SQLite y el bus de eventos en memoria; ver §7).

## 2. Variables de entorno

Copiar `.env.example` como `.env` y ajustar:

| Variable | Obligatoria | Descripción | Por defecto |
|---|---|---|---|
| `DATABASE_URL` | Sí | Archivo SQLite (ruta relativa a la raíz del proyecto) | `file:./data/sigr.db` |
| `SESSION_SECRET` | Sí | Clave para firmar la sesión, mínimo 32 caracteres | — |
| `COOKIE_SEGURA` | No | `false` permite la cookie de sesión sin HTTPS en producción (solo redes internas de prueba) | `true` en producción |
| `RESTAURANTE_RAZON_SOCIAL`, `RESTAURANTE_NIT`, `RESTAURANTE_DIRECCION`, `RESTAURANTE_TELEFONO` | No | Datos del emisor de las facturas. Las facturas ya emitidas conservan los datos que tenían | valores ficticios académicos |
| `SSE_LATIDO_MS` | No | Latido del canal de eventos y reverificación de sesión y rol | `15000` |
| `SSE_DURACION_MAX_MS` | No | Renovación periódica de cada conexión de eventos | `600000` (10 min) |
| `SSE_REINTENTO_MS` | No | Espera sugerida al navegador antes de reconectar | `2000` |

Generar una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## 3. Instalación nueva

```bash
git clone <url-del-repositorio> sigr
cd sigr
git checkout v1.1.0          # desplegar exactamente la versión etiquetada
npm ci
cp .env.example .env         # y editar SESSION_SECRET
npm run db:migrate           # crea el esquema (migraciones 0000–0006)
npm run db:seed              # opcional: usuarios y datos de prueba
npm run build
npm start                    # puerto 3000 por defecto; usar -- -p 8080 para cambiarlo
```

En producción la cookie de sesión es `Secure`: el sitio debe servirse por HTTPS, salvo en `localhost`.

### Proxy inverso y canal de eventos

El tablero de pedidos usa una conexión HTTP abierta (Server-Sent Events) en `/api/pedidos/eventos`. Si hay un proxy delante (Nginx, Caddy…), no debe acumular ni comprimir esa respuesta. El servidor ya envía `Cache-Control: no-cache, no-transform` y `X-Accel-Buffering: no`. Ejemplo para Nginx:

```nginx
location /api/pedidos/eventos {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 15m;   # mayor que SSE_DURACION_MAX_MS
}
```

## 4. Actualización desde v1.0.0

La v1.1.0 cambia el esquema: los comprobantes se convierten en facturas y se agregan jornada y turno.

1. **Respaldar** la base de datos: detener la aplicación y copiar `data/sigr.db`.
2. Obtener la versión:
   ```bash
   git fetch --tags
   git checkout v1.1.0
   ```
3. Instalar y migrar: `npm ci && npm run db:migrate`. Se aplican las migraciones 0001 a 0006 sobre los datos existentes.
4. Compilar y reiniciar: `npm run build`, luego `npm start` o el servicio configurado.
5. Revisar en `/facturas` que los comprobantes anteriores aparecen como facturas con el mismo número. En `/caja` deben verse los cierres anteriores con su jornada y turno.

**Reversión:** detener la aplicación, restaurar la copia de `data/sigr.db`, ejecutar `git checkout v1.0.0 && npm ci && npm run build` y reiniciar. Las migraciones no tienen reversión automática; por eso el respaldo del paso 1 es obligatorio.

## 5. Verificación posterior

1. Abrir `/menu` y comprobar que carga.
2. Iniciar sesión como mesero y abrir `/pedidos`: el indicador debe mostrar «En vivo».
3. Iniciar sesión como administrador y abrir `/caja` y `/facturas`.
4. Antes de cada despliegue, en el entorno de integración:
   - `npm run verificar`: lint, tipos, pruebas y compilación.
   - `npm run test:e2e`: pruebas de navegador.
   - `npm run auditoria`: dependencias.

## 6. Respaldo y restauración

La base de datos es el archivo `data/sigr.db`. Para respaldarla, detener la aplicación y copiar el archivo. Para restaurar, reemplazarlo por la copia y reiniciar.

## 7. Limitaciones conocidas

- SQLite y el bus de eventos en memoria funcionan con **una sola instancia** de la aplicación. Varias instancias requieren un motor cliente-servidor y un bus compartido (cambio futuro).
- Plataformas sin disco persistente, como las funciones serverless, no conservan el archivo SQLite. Tampoco mantienen conexiones de eventos largas.
