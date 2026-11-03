import { expect, test, type Page } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

/** Crea un pedido y lo deja ENTREGADO; devuelve la tarjeta del tablero. */
async function pedidoEntregado(p: Page, mesa: string, plato: string, cantidad: number) {
  await p.goto("/pedidos/nuevo");
  await p.getByLabel("Mesa").selectOption({ label: mesa });
  await p.getByLabel(`Cantidad de ${plato}`).fill(String(cantidad));
  await p.getByRole("button", { name: "Registrar pedido" }).click();
  await expect(p).toHaveURL(/\/pedidos$/);
  const tarjeta = p.locator("article", { hasText: mesa.split(" (")[0] });
  await tarjeta.getByRole("button", { name: "Pasar a preparación" }).click();
  await expect(tarjeta.locator("[data-estado]")).toHaveText("En preparación");
  await tarjeta.getByRole("button", { name: "Marcar entregado" }).click();
  await expect(tarjeta.locator("[data-estado]")).toHaveText("Entregado");
  return tarjeta;
}

test("factura con datos del cliente e impide facturar dos veces el mismo pedido", async ({ browser }) => {
  const contexto = await browser.newContext();
  const pestanaA = await contexto.newPage();
  await iniciarSesion(pestanaA, "mesero");
  const tarjeta = await pedidoEntregado(pestanaA, "Mesa 5 (6 personas)", "Mute santandereano", 2);
  await tarjeta.getByRole("link", { name: "Cobrar y facturar" }).click();
  await expect(pestanaA).toHaveURL(/\/pedidos\/\d+\/facturar$/);
  const urlFacturar = pestanaA.url();

  // Una segunda pestaña abre el mismo formulario antes de emitir.
  const pestanaB = await contexto.newPage();
  await pestanaB.goto(urlFacturar);

  await pestanaA.getByLabel("Medio de pago").selectOption("TRANSFERENCIA");
  await pestanaA.getByLabel("Con datos del cliente").check();
  await pestanaA.getByLabel("Tipo de documento").selectOption("NIT");
  await pestanaA.getByLabel("Número de documento").fill("901234567-8");
  await pestanaA.getByLabel("Nombre o razón social").fill("Comercializadora Ejemplo S.A.S.");
  await pestanaA.getByRole("button", { name: "Emitir factura" }).click();
  await expect(pestanaA).toHaveURL(/\/facturas\/\d+$/);
  const numero = await pestanaA.getByTestId("numero-factura").textContent();
  await expect(pestanaA.getByTestId("datos-cliente")).toContainText("NIT 901234567-8");
  await expect(pestanaA.getByTestId("datos-cliente")).toContainText("Comercializadora Ejemplo S.A.S.");
  await expect(pestanaA.getByTestId("datos-cliente")).toContainText("Transferencia");
  await expect(pestanaA.getByTestId("total-factura")).toHaveText(/\$\s?52\.000/);

  // La segunda pestaña intenta facturar el mismo pedido: el servidor lo rechaza.
  await pestanaB.getByRole("button", { name: "Emitir factura" }).click();
  await expect(pestanaB.locator("form").getByRole("alert")).toContainText("ya fue facturado");

  // Al volver al formulario, ya no permite emitir y enlaza la factura existente.
  await pestanaB.goto(urlFacturar);
  await expect(pestanaB.getByText("Este pedido ya fue facturado.")).toBeVisible();
  await expect(pestanaB.getByRole("link", { name: `Ver factura ${numero}` })).toBeVisible();
  await expect(pestanaB.getByRole("button", { name: "Emitir factura" })).toHaveCount(0);

  // El listado muestra la factura una sola vez.
  await pestanaB.goto("/facturas");
  await expect(pestanaB.getByRole("link", { name: numero! })).toHaveCount(1);
});

test("un cliente no puede ver ni emitir facturas", async ({ page }) => {
  await iniciarSesion(page, "cliente");
  for (const ruta of ["/facturas", "/facturas/1", "/pedidos/1/facturar"]) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/no-autorizado$/);
  }
});
