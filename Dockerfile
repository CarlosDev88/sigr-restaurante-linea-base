# syntax=docker/dockerfile:1
# Imagen de SIGR en tres etapas: dependencias → construcción → ejecución (solo dependencias de producción).
ARG NODE_VERSION=22

# 1. Dependencias completas (incluye las de desarrollo, necesarias para compilar)
FROM node:${NODE_VERSION}-bookworm-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Construcción: compila Next.js y empaqueta los scripts de migración y datos iniciales
FROM dependencias AS construccion
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build \
 && npm run build:scripts \
 && rm -rf .next/cache

# 3. Ejecución: imagen final mínima, usuario sin privilegios
FROM node:${NODE_VERSION}-bookworm-slim AS ejecucion
ARG APP_VERSION=dev
ARG GIT_SHA=local
ARG REPO_URL=https://github.com/CarlosDev88/sigr-restaurante-linea-base
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL=file:/app/data/sigr.db \
    MIGRACIONES_DIR=/app/drizzle \
    APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA}
LABEL org.opencontainers.image.title="SIGR" \
      org.opencontainers.image.description="Sistema Integral de Gestión de Restaurante" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="${REPO_URL}"
WORKDIR /app
COPY package.json package-lock.json ./
# Solo dependencias de producción; después se retiran npm/npx/corepack/yarn de la imagen
# (no se usan en ejecución y reducen la superficie de ataque y los hallazgos del escáner).
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=construccion /app/.next ./.next
COPY --from=construccion /app/dist ./dist
COPY next.config.ts ./
COPY drizzle ./drizzle
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN mkdir -p /app/data && chown node:node /app/data
# Usuario sin privilegios de la imagen oficial de Node (uid 1000)
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
