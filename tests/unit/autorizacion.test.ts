import { describe, expect, it } from "vitest";
import { autorizar, PERMISOS, type UsuarioSesion } from "@/lib/auth/permisos";
import { firmarSesion, verificarSesion } from "@/lib/auth/token";

const usuario = (rol: UsuarioSesion["rol"]): UsuarioSesion => ({ id: 1, nombre: "x", email: "x@x.co", rol });

describe("autorizar", () => {
  it("rechaza si no hay sesión", () => {
    expect(autorizar(null, ["ADMIN"])).toEqual({ ok: false, motivo: "NO_AUTENTICADO" });
  });

  it("rechaza un rol sin permiso", () => {
    expect(autorizar(usuario("CLIENTE"), PERMISOS.caja)).toEqual({ ok: false, motivo: "SIN_PERMISO" });
    expect(autorizar(usuario("MESERO"), PERMISOS.administrarMenu).ok).toBe(false);
  });

  it("acepta un rol permitido", () => {
    expect(autorizar(usuario("MESERO"), PERMISOS.gestionarPedidos).ok).toBe(true);
    expect(autorizar(usuario("ADMIN"), PERMISOS.caja).ok).toBe(true);
  });
});

describe("token de sesión", () => {
  it("firma y verifica", async () => {
    const token = await firmarSesion({ id: 7, rol: "MESERO" });
    expect(await verificarSesion(token)).toEqual({ id: 7, rol: "MESERO" });
  });

  it("rechaza un token alterado o ausente", async () => {
    const token = await firmarSesion({ id: 7, rol: "MESERO" });
    const [h, p, f] = token.split(".");
    const payloadFalso = Buffer.from(JSON.stringify({ sub: "7", rol: "ADMIN" })).toString("base64url");
    expect(await verificarSesion(`${h}.${payloadFalso}.${f}`)).toBeNull();
    expect(await verificarSesion(`${h}.${p}.firma-invalida`)).toBeNull();
    expect(await verificarSesion(undefined)).toBeNull();
  });
});
