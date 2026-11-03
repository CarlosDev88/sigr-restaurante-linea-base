import { expect, type Page } from "@playwright/test";

export const USUARIOS = {
  admin: { email: "admin@sigr.local", password: "Admin123*" },
  mesero: { email: "mesero@sigr.local", password: "Mesero123*" },
  cliente: { email: "cliente@sigr.local", password: "Cliente123*" },
} as const;

export async function iniciarSesion(page: Page, quien: keyof typeof USUARIOS) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(USUARIOS[quien].email);
  await page.getByLabel("Contraseña").fill(USUARIOS[quien].password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Fecha de mañana (AAAA-MM-DD) en la zona horaria de Bogotá. */
export function mananaBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(Date.now() + 86_400_000));
}
