import { expect, test, type Page } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

const estadoConexion = (p: Page) => p.getByTestId("estado-conexion");

async function crearPedido(p: Page, mesa: string, plato: string) {
  await p.goto("/pedidos/nuevo");
  await p.getByLabel("Mesa").selectOption({ label: mesa });
  await p.getByLabel(`Cantidad de ${plato}`).fill("1");
  await p.getByRole("button", { name: "Registrar pedido" }).click();
  await expect(p).toHaveURL(/\/pedidos$/);
}

test.describe("pedidos en tiempo real", () => {
  test("un cambio de estado hecho en una sesión aparece en otra sin recargar", async ({ browser }) => {
    const mesero = await (await browser.newContext()).newPage();
    const admin = await (await browser.newContext()).newPage();
    await iniciarSesion(mesero, "mesero");
    await iniciarSesion(admin, "admin");
    await mesero.goto("/pedidos");
    await expect(estadoConexion(mesero)).toHaveAttribute("data-estado", "conectado");

    await crearPedido(admin, "Mesa 6 (8 personas)", "Mute santandereano");
    const tarjetaMesero = mesero.locator("article", { hasText: "Mesa 6" });
    await expect(tarjetaMesero).toBeVisible({ timeout: 3000 });

    const tarjetaAdmin = admin.locator("article", { hasText: "Mesa 6" });
    await tarjetaAdmin.getByRole("button", { name: "Pasar a preparación" }).click();
    await expect(tarjetaMesero.locator("[data-estado]")).toHaveText("En preparación", { timeout: 3000 });
    await tarjetaAdmin.getByRole("button", { name: "Cancelar" }).click();
    await expect(tarjetaMesero).toHaveCount(0, { timeout: 3000 });
  });

  test("un usuario sin permiso no recibe eventos ni datos de pedidos", async ({ page, request }) => {
    // Sin sesión: 401 (lo responde el Proxy antes de llegar al canal).
    const anonimo = await request.get("/api/pedidos/eventos");
    expect(anonimo.status()).toBe(401);
    expect(await anonimo.text()).not.toContain("pedidos");

    await iniciarSesion(page, "cliente");
    const r = await page.request.get("/api/pedidos/eventos");
    expect(r.status()).toBe(403);
    expect(r.headers()["content-type"]).toContain("application/json");
    expect(await r.text()).not.toContain("mesa");

    // Desde el navegador: EventSource no recibe ningún evento y queda cerrado.
    const resultado = await page.evaluate(
      () =>
        new Promise<{ estado: number | string; eventos: number }>((resolve) => {
          const es = new EventSource("/api/pedidos/eventos");
          let eventos = 0;
          es.addEventListener("pedidos", () => eventos++);
          es.onerror = () => {
            const estado = es.readyState;
            es.close();
            resolve({ estado, eventos });
          };
          setTimeout(() => resolve({ estado: "sin-respuesta", eventos }), 5000);
        }),
    );
    expect(resultado).toEqual({ estado: 2, eventos: 0 });

    // Y la página del tablero no es accesible.
    await page.goto("/pedidos");
    await expect(page).toHaveURL(/\/no-autorizado$/);
  });

  test("la conexión se renueva periódicamente y sigue recibiendo cambios", async ({ browser }) => {
    const mesero = await (await browser.newContext()).newPage();
    const admin = await (await browser.newContext()).newPage();
    await iniciarSesion(mesero, "mesero");
    await iniciarSesion(admin, "admin");
    await mesero.goto("/pedidos");

    // SSE_DURACION_MAX_MS=4000 en pruebas: el servidor cierra y el navegador se reconecta.
    await expect
      .poll(async () => Number(await estadoConexion(mesero).getAttribute("data-conexiones")), { timeout: 12_000 })
      .toBeGreaterThanOrEqual(2);
    await expect(estadoConexion(mesero)).toHaveAttribute("data-estado", "conectado");

    await crearPedido(admin, "Mesa 2 (2 personas)", "Jugo natural");
    await expect(mesero.locator("article", { hasText: "Mesa 2" })).toBeVisible({ timeout: 3000 });
  });

  test("tras una caída de red se reconecta y recupera los cambios ocurridos durante el corte", async ({ browser }) => {
    const contextoMesero = await browser.newContext();
    const mesero = await contextoMesero.newPage();
    const admin = await (await browser.newContext()).newPage();
    await iniciarSesion(mesero, "mesero");
    await iniciarSesion(admin, "admin");
    await mesero.goto("/pedidos");
    await expect(estadoConexion(mesero)).toHaveAttribute("data-estado", "conectado");

    await contextoMesero.setOffline(true);
    await expect(estadoConexion(mesero)).toHaveAttribute("data-estado", "reconectando", { timeout: 10_000 });
    await expect(estadoConexion(mesero)).toContainText("reconectando");

    // Cambio ocurrido mientras el mesero está sin conexión.
    await crearPedido(admin, "Mesa 4 (4 personas)", "Patacones con hogao");
    await expect(mesero.locator("article", { hasText: "Mesa 4" })).toHaveCount(0);

    await contextoMesero.setOffline(false);
    await expect(estadoConexion(mesero)).toHaveAttribute("data-estado", "conectado", { timeout: 15_000 });
    await expect(mesero.locator("article", { hasText: "Mesa 4" })).toBeVisible({ timeout: 3000 });
  });
});
