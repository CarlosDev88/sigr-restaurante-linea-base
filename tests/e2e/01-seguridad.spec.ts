import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

test("sin sesión, las rutas protegidas redirigen a /login y la API responde 401", async ({ page, request }) => {
  for (const ruta of ["/pedidos", "/caja", "/admin/menu", "/reservas"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/pedidos")).status()).toBe(401);
});

test("un cliente autenticado no accede a módulos de otros roles", async ({ page }) => {
  await iniciarSesion(page, "cliente");
  for (const ruta of ["/pedidos", "/caja", "/caja/reportes", "/admin/menu", "/admin/reservas"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/no-autorizado$/);
  }
  // La API también verifica el rol (no depende del Proxy ni de la interfaz).
  expect((await page.request.get("/api/pedidos")).status()).toBe(403);
});

test("credenciales incorrectas muestran un error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("admin@sigr.local");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
});
