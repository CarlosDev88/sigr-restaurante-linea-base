import type { NextConfig } from "next";

// Decisión de línea base: no se activa `cacheComponents`. Todas las vistas leen la
// sesión o datos operativos (pedidos, caja) que deben estar siempre actualizados,
// así que se renderizan por solicitud. Ver docs/decisiones.md.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
