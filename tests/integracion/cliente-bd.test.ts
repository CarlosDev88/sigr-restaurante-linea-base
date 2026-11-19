import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { crearBD } from "@/lib/db/cliente";

const temporal = mkdtempSync(path.join(os.tmpdir(), "sigr-bd-"));
afterAll(() => rmSync(temporal, { recursive: true, force: true }));

describe("cliente de base de datos", () => {
  it("crea la carpeta de la base de datos si no existe (instalación limpia)", async () => {
    const archivo = path.join(temporal, "no", "existe", "sigr.db");
    const bd = crearBD(`file:${archivo}`);
    await bd.$client.execute("SELECT 1");
    expect(existsSync(archivo)).toBe(true);
    bd.$client.close();
  });
});
