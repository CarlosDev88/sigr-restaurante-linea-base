import { beforeEach, describe, expect, it } from "vitest";
import { autenticar } from "@/lib/services/usuarios";
import { crearUsuario, db, limpiarBD } from "../helpers/db";

describe("autenticación", () => {
  beforeEach(async () => {
    await limpiarBD();
    await crearUsuario("MESERO", "mesero@test.local", "Clave123*");
  });

  it("acepta credenciales válidas y devuelve el rol", async () => {
    const u = await autenticar(db, "MESERO@test.local ", "Clave123*");
    expect(u?.rol).toBe("MESERO");
  });

  it("rechaza contraseña incorrecta o usuario inexistente", async () => {
    expect(await autenticar(db, "mesero@test.local", "otra")).toBeNull();
    expect(await autenticar(db, "nadie@test.local", "Clave123*")).toBeNull();
  });
});
