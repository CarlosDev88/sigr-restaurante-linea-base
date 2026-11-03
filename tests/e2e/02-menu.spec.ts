import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

test("el administrador crea un plato, aparece en el menú público y se puede ocultar", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto("/admin/menu");

  const nuevo = page.locator("form", { has: page.getByRole("button", { name: "Crear plato" }) });
  await nuevo.getByLabel("Nombre del plato").fill("Arepa de choclo");
  await nuevo.getByLabel("Precio").fill("8500");
  await nuevo.getByRole("combobox").selectOption({ label: "Entradas" });
  await nuevo.getByRole("button", { name: "Crear plato" }).click();
  await expect(nuevo.getByRole("status")).toHaveText("Plato creado.");

  await page.goto("/menu");
  await expect(page.getByText("Arepa de choclo")).toBeVisible();

  await page.goto("/admin/menu");
  const fila = page.locator('li[data-plato="Arepa de choclo"]');
  await fila.getByLabel("Disponible").uncheck();
  await fila.getByRole("button", { name: "Guardar" }).click();
  await expect(fila.getByRole("status")).toHaveText("Guardado.");

  await page.goto("/menu");
  await expect(page.getByText("Arepa de choclo")).toHaveCount(0);
});
