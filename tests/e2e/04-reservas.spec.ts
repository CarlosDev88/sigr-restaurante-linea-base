import { expect, test } from "@playwright/test";
import { iniciarSesion, mananaBogota } from "./utilidades";

test("el cliente reserva; dos reservas en la misma franja reciben mesas distintas", async ({ page }) => {
  await iniciarSesion(page, "cliente");
  await page.goto("/reservas");

  const reservar = async () => {
    await page.getByLabel("Fecha").fill(mananaBogota());
    await page.getByLabel("Hora").selectOption("19:00");
    await page.getByLabel("Personas").fill("4");
    await page.getByRole("button", { name: "Reservar" }).click();
  };

  await reservar();
  await expect(page.getByRole("status")).toContainText("mesa 3");
  await reservar();
  await expect(page.getByRole("status")).toContainText("mesa 4");
  await expect(page.locator("tr[data-reserva]")).toHaveCount(2);

  await page.locator("tr[data-reserva]").first().getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator("tr[data-reserva]").first()).toContainText("Cancelada");
});
