import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/pedidos/eventos/route";
import { COOKIE_SESION, firmarSesion } from "@/lib/auth/token";
import { mesas, usuarios } from "@/lib/db/schema";
import { publicarCambioPedidos, suscriptoresPedidos } from "@/lib/eventos/pedidos";
import { crearCategoria, crearPlato } from "@/lib/services/menu";
import { crearPedido } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";

const URL_EVENTOS = "http://localhost/api/pedidos/eventos";

function solicitud(token?: string, signal?: AbortSignal) {
  return new NextRequest(URL_EVENTOS, {
    headers: token ? { cookie: `${COOKIE_SESION}=${token}` } : {},
    signal,
  });
}

/** Lee el flujo SSE y devuelve los eventos completos a medida que llegan. */
function lector(respuesta: Response, ignorar: string[] = ["conexion", "latido"]) {
  const reader = respuesta.body!.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  return async function siguienteEvento(timeoutMs = 2000): Promise<{ evento: string; datos: unknown }> {
    const limite = Date.now() + timeoutMs;
    for (;;) {
      const fin = buffer.indexOf("\n\n");
      if (fin >= 0) {
        const bloque = buffer.slice(0, fin);
        buffer = buffer.slice(fin + 2);
        const evento = /^event: (.*)$/m.exec(bloque)?.[1];
        const datos = /^data: (.*)$/m.exec(bloque)?.[1];
        if (evento && datos && !ignorar.includes(evento)) return { evento, datos: JSON.parse(datos) };
        continue; // retry, conexion o latido
      }
      const restante = limite - Date.now();
      if (restante <= 0) throw new Error("tiempo agotado esperando evento");
      const r = await Promise.race([
        reader.read(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), restante)),
      ]);
      if (r.done) return null as unknown as { evento: string; datos: unknown };
      buffer += dec.decode(r.value, { stream: true });
    }
  };
}

describe("canal de eventos de pedidos (/api/pedidos/eventos)", () => {
  let mesero: { id: number };
  let mesaId: number;
  let platoId: number;
  const controladores: AbortController[] = [];

  beforeEach(async () => {
    await limpiarBD();
    mesero = await crearUsuario("MESERO");
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 7, capacidad: 4 }).returning();
    const categoriaId = (await crearCategoria(db, { nombre: "Carta" })).id;
    platoId = (await crearPlato(db, { nombre: "Mute", precio: 26000, categoriaId })).id;
  });

  afterEach(() => {
    for (const c of controladores.splice(0)) c.abort();
    delete process.env.SSE_LATIDO_MS;
    delete process.env.SSE_DURACION_MAX_MS;
  });

  async function conectar(token: string) {
    const c = new AbortController();
    controladores.push(c);
    const r = await GET(solicitud(token, c.signal));
    return { r, c, siguiente: lector(r) };
  }

  it("rechaza sin sesión (401) y a un rol sin permiso (403) sin enviar datos de pedidos", async () => {
    await crearPedido(db, mesero.id, { mesaId, items: [{ platoId, cantidad: 1 }] });
    const sinSesion = await GET(solicitud());
    expect(sinSesion.status).toBe(401);

    const cliente = await crearUsuario("CLIENTE");
    const r = await GET(solicitud(await firmarSesion({ id: cliente.id, rol: "CLIENTE" })));
    expect(r.status).toBe(403);
    expect(r.headers.get("content-type")).toContain("application/json");
    const cuerpo = await r.text();
    expect(cuerpo).not.toContain("pedidos");
    expect(cuerpo).not.toContain("Mute");
    expect(suscriptoresPedidos()).toBe(0);
  });

  it("rechaza un token alterado aunque diga ADMIN", async () => {
    const token = await firmarSesion({ id: mesero.id, rol: "MESERO" });
    const [h, , f] = token.split(".");
    const falso = Buffer.from(JSON.stringify({ sub: String(mesero.id), rol: "ADMIN" })).toString("base64url");
    expect((await GET(solicitud(`${h}.${falso}.${f}`))).status).toBe(401);
  });

  it("entrega la instantánea inicial y los cambios a dos sesiones autorizadas", async () => {
    const admin = await crearUsuario("ADMIN");
    const a = await conectar(await firmarSesion({ id: mesero.id, rol: "MESERO" }));
    const b = await conectar(await firmarSesion({ id: admin.id, rol: "ADMIN" }));
    expect(a.r.headers.get("content-type")).toContain("text/event-stream");

    expect(await a.siguiente()).toMatchObject({ evento: "pedidos", datos: { motivo: { tipo: "inicial" }, pedidos: [] } });
    expect(await b.siguiente()).toMatchObject({ evento: "pedidos", datos: { pedidos: [] } });
    expect(suscriptoresPedidos()).toBe(2);

    const pedido = await crearPedido(db, mesero.id, { mesaId, items: [{ platoId, cantidad: 2 }] });
    await publicarCambioPedidos(db, { tipo: "creado", pedidoId: pedido.id });

    for (const sesion of [a, b]) {
      const e = (await sesion.siguiente()) as { datos: { motivo: unknown; pedidos: { id: number; total: number }[] } };
      expect(e.datos.motivo).toEqual({ tipo: "creado", pedidoId: pedido.id });
      expect(e.datos.pedidos).toMatchObject([{ id: pedido.id, mesa: 7, total: 52000 }]);
    }
  });

  it("informa el intervalo de latido y envía latidos como eventos", async () => {
    process.env.SSE_LATIDO_MS = "40";
    const c = new AbortController();
    controladores.push(c);
    const r = await GET(solicitud(await firmarSesion({ id: mesero.id, rol: "MESERO" }), c.signal));
    const siguiente = lector(r, []);
    expect(await siguiente()).toEqual({ evento: "conexion", datos: { latidoMs: 40 } });
    expect((await siguiente()).evento).toBe("pedidos");
    expect((await siguiente()).evento).toBe("latido");
  });

  it("libera la suscripción cuando el cliente se desconecta", async () => {
    const s = await conectar(await firmarSesion({ id: mesero.id, rol: "MESERO" }));
    await s.siguiente();
    expect(suscriptoresPedidos()).toBe(1);
    s.c.abort();
    await new Promise((r) => setTimeout(r, 20));
    expect(suscriptoresPedidos()).toBe(0);
  });

  it("cierra el canal si el usuario pierde el permiso durante la conexión", async () => {
    process.env.SSE_LATIDO_MS = "50";
    const s = await conectar(await firmarSesion({ id: mesero.id, rol: "MESERO" }));
    await s.siguiente();
    await db.update(usuarios).set({ rol: "CLIENTE" }).where(eq(usuarios.id, mesero.id));
    expect(await s.siguiente()).toEqual({ evento: "cierre", datos: { motivo: "SIN_AUTORIZACION" } });
    expect(await s.siguiente()).toBeNull(); // flujo terminado
    expect(suscriptoresPedidos()).toBe(0);

    // y ya no puede volver a conectarse
    expect((await GET(solicitud(await firmarSesion({ id: mesero.id, rol: "MESERO" })))).status).toBe(403);
  });

  it("renueva la conexión al cumplir la duración máxima", async () => {
    process.env.SSE_DURACION_MAX_MS = "80";
    const s = await conectar(await firmarSesion({ id: mesero.id, rol: "MESERO" }));
    await s.siguiente();
    expect(await s.siguiente()).toEqual({ evento: "cierre", datos: { motivo: "RENOVAR" } });
    expect(await s.siguiente()).toBeNull();
    expect(suscriptoresPedidos()).toBe(0);
  });
});
