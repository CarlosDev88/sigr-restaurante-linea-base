import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

test("una venta posterior a un cierre se cierra en el turno siguiente sin alterar los cierres anteriores", async ({ browser }) => {
  const jornada = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const admin = await (await browser.newContext()).newPage();
  await iniciarSesion(admin, "admin");

  // Si hay pendientes de pruebas anteriores, se cierran primero para partir de un estado conocido.
  await admin.goto("/caja");
  const bloque = admin.locator(`[data-jornada="${jornada}"]`);
  if (await bloque.count()) {
    await bloque.getByRole("button", { name: /Cerrar turno/ }).click();
    await expect(admin.getByRole("status")).toContainText("turno");
  }
  const filas = admin.getByTestId("historial-cierres").locator("tbody tr");
  const antes = await filas.allTextContents();
  const turnosPrevios = antes.filter((t) => t.startsWith(jornada)).length;

  // Nueva venta en la misma jornada.
  await admin.goto("/pedidos/nuevo");
  await admin.getByLabel("Mesa").selectOption({ label: "Mesa 1 (2 personas)" });
  await admin.getByLabel("Cantidad de Brownie con helado").fill("2");
  await admin.getByRole("button", { name: "Registrar pedido" }).click();
  const tarjeta = admin.locator("article", { hasText: "Mesa 1" });
  await tarjeta.getByRole("button", { name: "Pasar a preparación" }).click();
  await tarjeta.getByRole("button", { name: "Marcar entregado" }).click();
  await tarjeta.getByRole("link", { name: "Cobrar y facturar" }).click();
  await admin.getByRole("button", { name: "Emitir factura" }).click();
  await expect(admin).toHaveURL(/\/facturas\/\d+$/);

  await admin.goto("/caja");
  const siguiente = turnosPrevios + 1;
  await expect(bloque.getByTestId("total-pendiente")).toHaveText(/\$\s?22\.000/);
  await bloque.getByRole("button", { name: `Cerrar turno ${siguiente} de la jornada ${jornada}` }).click();
  await expect(admin.getByRole("status")).toContainText(`turno ${siguiente}: 1 facturas`);

  // Los cierres anteriores siguen idénticos; el nuevo aparece primero.
  const despues = await filas.allTextContents();
  expect(despues.slice(1)).toEqual(antes.filter((t) => !t.startsWith("Sin cierres")));
  expect(despues[0]).toMatch(new RegExp(`^${jornada}${siguiente}`));
  expect(despues[0]).toContain("22.000");
});
