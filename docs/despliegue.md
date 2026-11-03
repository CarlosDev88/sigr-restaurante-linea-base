# Manual de despliegue

## 1. Requisitos

- Node.js 20.9 o superior y npm.
- Acceso de escritura a la carpeta del proyecto (SQLite crea `data/sigr.db`).

## 2. Variables de entorno

Copiar `.env.example` como `.env` y ajustar:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Archivo SQLite (ruta relativa a la raíz del proyecto) | `file:./data/sigr.db` |
| `SESSION_SECRET` | Clave para firmar la sesión, mínimo 32 caracteres | cadena aleatoria |
| `COOKIE_SEGURA` | Opcional. `false` permite la cookie de sesión sin HTTPS en producción (solo para redes internas de prueba) | `false` |

Generar una clave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## 3. Despliegue en un servidor (producción)

```bash
git clone <url-del-repositorio> sigr
cd sigr
git checkout v1.0.0          # desplegar exactamente la línea base
npm ci
cp .env.example .env         # y editar SESSION_SECRET
npm run db:migrate           # crea o actualiza el esquema
npm run db:seed              # opcional: usuarios y datos de prueba
npm run build
npm start                    # puerto 3000 por defecto; usar -- -p 8080 para cambiarlo
```

En producción la cookie de sesión es `Secure`: el sitio debe servirse por HTTPS (por ejemplo, detrás de Nginx o Caddy), salvo en `localhost`.

## 4. Verificación posterior

1. Abrir `/menu` y comprobar que carga el menú.
2. Iniciar sesión con un usuario administrador y abrir `/caja`.
3. Ejecutar `npm run verificar` en el entorno de integración antes de cada despliegue.

## 5. Actualizaciones

1. `git fetch --tags && git checkout <nueva-etiqueta>`
2. `npm ci && npm run db:migrate && npm run build`
3. Reiniciar el proceso (`npm start` o el servicio configurado).

## 6. Respaldo y restauración

La base de datos es el archivo `data/sigr.db`. Para respaldarla, detener la aplicación y copiar el archivo. Para restaurar, reemplazarlo por la copia y reiniciar.

## 7. Limitaciones conocidas

- SQLite atiende una sola instancia de la aplicación. Para varias instancias se debe migrar a un motor cliente-servidor (registrado como cambio futuro).
- Plataformas sin disco persistente (por ejemplo, funciones serverless) no conservan el archivo SQLite.
