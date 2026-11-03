// Verificación estática: toda Server Action y Route Handler comprueba el rol en el servidor.
// Si alguien agrega una acción sin `exigirRol`, esta prueba falla.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "../../src/app");
const ACCIONES_PUBLICAS = ["iniciarSesion", "salir"];

function archivos(dir: string, nombre: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = path.join(dir, f);
    if (statSync(ruta).isDirectory()) return archivos(ruta, nombre);
    return f === nombre ? [ruta] : [];
  });
}

describe("autorización en el servidor", () => {
  const accionesArchivos = archivos(APP, "actions.ts");

  it("encuentra los archivos de Server Actions", () => {
    expect(accionesArchivos.length).toBeGreaterThanOrEqual(5);
  });

  for (const archivo of accionesArchivos) {
    const codigo = readFileSync(archivo, "utf8");
    const partes = codigo.split(/export async function /).slice(1);
    for (const parte of partes) {
      const nombre = parte.slice(0, parte.indexOf("("));
      if (ACCIONES_PUBLICAS.includes(nombre)) continue;
      it(`${path.relative(APP, archivo)} → ${nombre} llama a exigirRol`, () => {
        expect(parte).toMatch(/await exigirRol\(/);
      });
    }
  }

  for (const archivo of archivos(APP, "route.ts")) {
    it(`${path.relative(APP, archivo)} verifica el rol`, () => {
      expect(readFileSync(archivo, "utf8")).toMatch(/autorizar\(await (obtenerUsuarioActual\(\)|usuarioDesdeToken\()/);
    });
  }

  for (const archivo of archivos(APP, "page.tsx")) {
    const relativo = path.relative(APP, archivo);
    const publica = /^(page\.tsx|login|menu|no-autorizado)/.test(relativo);
    if (publica) continue;
    it(`${relativo} llama a exigirRol`, () => {
      expect(readFileSync(archivo, "utf8")).toMatch(/await exigirRol\(/);
    });
  }
});
