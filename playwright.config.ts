import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

// Pruebas de extremo a extremo contra la aplicación compilada (next build + next start)
// usando una base de datos SQLite propia (data/e2e.db) recreada en cada ejecución.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run e2e:servidor -- -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/menu`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: "file:./data/e2e.db",
      SESSION_SECRET: "clave-solo-para-pruebas-e2e-0123456789abcdef",
      // Conexiones de eventos cortas para ejercitar la renovación y reconexión en las pruebas.
      SSE_DURACION_MAX_MS: "4000",
      SSE_REINTENTO_MS: "500",
      SSE_LATIDO_MS: "1000",
    },
  },
});
