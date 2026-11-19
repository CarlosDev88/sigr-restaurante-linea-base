// Prueba de carga corta contra el entorno de staging (k6).
// Valida requisitos no funcionales de rendimiento y disponibilidad con umbrales:
// si un umbral no se cumple, k6 termina con error y el pipeline falla.
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    carga_normal: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 20 }, // subida
        { duration: "20s", target: 20 }, // carga sostenida: 20 usuarios simultáneos
        { duration: "5s", target: 0 }, // bajada
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // disponibilidad: menos del 1 % de errores
    "http_req_duration{pagina:menu}": ["p(95)<800"], // rendimiento: menú público
    "http_req_duration{pagina:salud}": ["p(95)<300"],
    "http_req_duration{pagina:login}": ["p(95)<800"],
    checks: ["rate>0.99"],
  },
};

export default function recorridoUsuario() {
  group("menú público", () => {
    const r = http.get(`${BASE}/menu`, { tags: { pagina: "menu" } });
    check(r, { "menú responde 200": (x) => x.status === 200, "menú tiene platos": (x) => x.body.includes("Bandeja paisa") });
  });
  group("salud", () => {
    const r = http.get(`${BASE}/api/salud`, { tags: { pagina: "salud" } });
    check(r, { "salud ok": (x) => x.status === 200 && x.json("estado") === "ok" });
  });
  group("login", () => {
    const r = http.get(`${BASE}/login`, { tags: { pagina: "login" } });
    check(r, { "login responde 200": (x) => x.status === 200 });
  });
  sleep(1);
}

export function handleSummary(datos) {
  return { "reportes/k6-resumen.json": JSON.stringify(datos, null, 2), stdout: textoResumen(datos) };
}

function textoResumen(d) {
  const m = d.metrics;
  const p95 = (n) => (m[n] ? m[n].values["p(95)"].toFixed(1) + " ms" : "s/d");
  return [
    "",
    "Resumen de la prueba de carga",
    `  Solicitudes: ${m.http_reqs.values.count} (${m.http_reqs.values.rate.toFixed(1)}/s)`,
    `  Errores: ${(m.http_req_failed.values.rate * 100).toFixed(2)} %`,
    `  p95 menú: ${p95("http_req_duration{pagina:menu}")} · p95 salud: ${p95("http_req_duration{pagina:salud}")} · p95 login: ${p95("http_req_duration{pagina:login}")}`,
    "Umbrales:",
    ...Object.entries(m)
      .filter(([, v]) => v.thresholds)
      .flatMap(([nombre, v]) =>
        Object.entries(v.thresholds).map(([regla, r]) => `  ${r.ok ? "✓" : "✗"} ${nombre} ${regla}`),
      ),
    "",
  ].join("\n");
}
