import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./utilidades";

test("pedido completo: registro, actualización en tiempo real, cobro con factura y cierre de caja", async ({ browser }) => {
  // Dos pantallas independientes: el administrador observa el tablero y el mesero registra.
  const admin = await (await browser.newContext()).newPage();
  const mesero = await (await browser.newContext()).newPage();
  await iniciarSesion(admin, "admin");
  await iniciarSesion(mesero, "mesero");
  await admin.goto("/pedidos");
  await expect(admin.getByText("No hay pedidos en curso.")).toBeVisible();

  // 1. El mesero registra el pedido.
  await mesero.goto("/pedidos/nuevo");
  await mesero.getByLabel("Mesa").selectOption({ label: "Mesa 3 (4 personas)" });
  await mesero.getByLabel("Cantidad de Bandeja paisa").fill("1");
  await mesero.getByLabel("Cantidad de Limonada de coco").fill("2");
  await mesero.getByRole("button", { name: "Registrar pedido" }).click();
  await expect(mesero).toHaveURL(/\/pedidos$/);
  const tarjetaMesero = mesero.locator("article", { hasText: "Mesa 3" });
  await expect(tarjetaMesero).toContainText(/Total: \$\s?50\.000/);

  // 2. Sin recargar, el tablero del administrador lo recibe por eventos (límite: 3 s).
  await expect(admin.locator("article", { hasText: "Mesa 3" })).toBeVisible({
    timeout: 3000,
  });

  // 3. Cambios de estado y cobro.
  await tarjetaMesero.getByRole("button", { name: "Pasar a preparación" }).click();
  await expect(tarjetaMesero.locator("[data-estado]")).toHaveText("En preparación");
  await tarjetaMesero.getByRole("button", { name: "Marcar entregado" }).click();
  await expect(tarjetaMesero.locator("[data-estado]")).toHaveText("Entregado");
  await expect(admin.locator("article", { hasText: "Mesa 3" }).locator("[data-estado]")).toHaveText("Entregado", {
    timeout: 3000,
  });
  await tarjetaMesero.getByRole("link", { name: "Cobrar y facturar" }).click();
  await expect(mesero).toHaveURL(/\/pedidos\/\d+\/facturar$/);
  await expect(mesero.getByTestId("total-a-facturar")).toHaveText(/\$\s?50\.000/);
  await mesero.getByLabel("Medio de pago").selectOption("EFECTIVO");
  await mesero.getByRole("button", { name: "Emitir factura" }).click();
  await expect(mesero).toHaveURL(/\/facturas\/1$/);
  await expect(mesero.getByTestId("numero-factura")).toHaveText("FA-000001");
  await expect(mesero.getByTestId("subtotal-factura")).toHaveText(/\$\s?46\.296/);
  await expect(mesero.getByTestId("impuesto-factura")).toHaveText(/\$\s?3\.704/);
  await expect(mesero.getByTestId("total-factura")).toHaveText(/\$\s?50\.000/);
  // El pedido facturado sale del tablero del administrador en tiempo real.
  await expect(admin.locator("article", { hasText: "Mesa 3" })).toHaveCount(0, { timeout: 3000 });

  // 4. Cierre del turno de la jornada actual (hora de Bogotá) por el administrador.
  const jornada = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  await admin.goto("/caja");
  const bloque = admin.locator(`[data-jornada="${jornada}"]`);
  await expect(bloque.getByTestId("total-pendiente")).toHaveText(/\$\s?50\.000/);
  await bloque.getByRole("button", { name: `Cerrar turno 1 de la jornada ${jornada}` }).click();
  await expect(admin.getByRole("status")).toContainText(`jornada ${jornada}, turno 1: 1 facturas`);
  await expect(admin.getByTestId("historial-cierres")).toContainText("Administrador");
  await expect(admin.getByText("No hay facturas pendientes.")).toBeVisible();

  // 5. El reporte del día incluye la venta.
  await admin.goto("/caja/reportes?dias=1");
  await expect(admin.getByRole("row", { name: /Bandeja paisa/ })).toBeVisible();
});
