import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/salud/route";
import paquete from "../../package.json";

describe("verificación de salud (/api/salud)", () => {
  it("responde 200 con versión y estado de la base de datos, sin datos de negocio", async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const cuerpo = await r.json();
    expect(cuerpo).toMatchObject({ estado: "ok", baseDeDatos: "ok", version: paquete.version });
    expect(Object.keys(cuerpo).sort()).toEqual(["baseDeDatos", "commit", "estado", "tiempoActivoSeg", "version"]);
  });
});
