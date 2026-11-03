import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` lanza error fuera de React Server Components; en pruebas se reemplaza.
      "server-only": path.resolve(__dirname, "tests/helpers/server-only-vacio.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integracion/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./data/test.db",
      SESSION_SECRET: "clave-de-pruebas-solo-para-vitest-1234567890",
    },
    // Las pruebas de integración comparten un archivo SQLite: se ejecutan en serie.
    fileParallelism: false,
    coverage: {
      include: ["src/lib/**"],
      exclude: ["src/lib/db.ts"],
    },
  },
});
