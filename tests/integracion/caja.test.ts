import { beforeEach, describe, expect, it } from "vitest";
import { cierresCaja, facturas, mesas } from "@/lib/db/schema";
import { cajaAbierta, cerrarCaja, listarCierres, reporteVentas } from "@/lib/services/caja";
import { facturarPedido } from "@/lib/services/facturacion";
import { crearCategoria, crearPlato } from "@/lib/services/menu";
import { crearPedido } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";
import { pedidoEntregado } from "../helpers/pedidos";

const CONSUMIDOR = { tipoCliente: "CONSUMIDOR_FINAL", medioPago: "EFECTIVO" } as const;
/** Instante en hora de Bogotá (UTC-5). */
const bogota = (fechaHora: string) => new Date(`${fechaHora}-05:00`);

describe("cierre diario de caja por jornada (hora de Bogotá) y turno", () => {
  let meseroId: number;
  let adminId: number;
  let mesaId: number;
  let bandeja: number;
  let jugo: number;
  const facturarEn = async (instante: Date, items: { platoId: number; cantidad: number }[]) =>
    facturarPedido(db, await pedidoEntregado(db, meseroId, mesaId, items), meseroId, CONSUMIDOR, instante);

  beforeEach(async () => {
    await limpiarBD();
    meseroId = (await crearUsuario("MESERO")).id;
    adminId = (await crearUsuario("ADMIN")).id;
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 1, capacidad: 4 }).returning();
    const categoriaId = (await crearCategoria(db, { nombre: "Carta" })).id;
    bandeja = (await crearPlato(db, { nombre: "Bandeja paisa", precio: 32000, categoriaId })).id;
    jugo = (await crearPlato(db, { nombre: "Jugo", precio: 7000, categoriaId })).id;
  });

  it("asigna la jornada según la hora de Bogotá, no la UTC", async () => {
    // 23:50 y 00:10 en Bogotá caen el mismo día en UTC (04:50 y 05:10 del 11 de mayo).
    const a = await facturarEn(bogota("2030-05-10T23:50:00"), [{ platoId: bandeja, cantidad: 1 }]);
    const b = await facturarEn(bogota("2030-05-11T00:10:00"), [{ platoId: jugo, cantidad: 1 }]);
    expect(a.emitidaEn.toISOString().slice(0, 10)).toBe(b.emitidaEn.toISOString().slice(0, 10));
    expect([a.jornada, b.jornada]).toEqual(["2030-05-10", "2030-05-11"]);
  });

  it("separa las facturas de jornadas distintas en cierres distintos", async () => {
    const ahora = bogota("2030-05-11T09:00:00");
    await facturarEn(bogota("2030-05-10T20:00:00"), [{ platoId: bandeja, cantidad: 1 }]);
    await facturarEn(bogota("2030-05-10T23:59:59"), [{ platoId: jugo, cantidad: 1 }]);
    await facturarEn(bogota("2030-05-11T00:00:00"), [{ platoId: jugo, cantidad: 2 }]);

    const abierta = await cajaAbierta(db);
    expect(abierta.jornadas.map((j) => [j.jornada, j.facturas.length, j.total, j.siguienteTurno])).toEqual([
      ["2030-05-10", 2, 39000, 1],
      ["2030-05-11", 1, 14000, 1],
    ]);

    const c10 = await cerrarCaja(db, adminId, "2030-05-10", ahora);
    expect(c10).toMatchObject({ jornada: "2030-05-10", turno: 1, total: 39000, cantidadFacturas: 2, responsableId: adminId });
    // La factura del 11 sigue pendiente: el cierre del 10 no la incluye.
    expect((await cajaAbierta(db)).jornadas.map((j) => j.jornada)).toEqual(["2030-05-11"]);

    const c11 = await cerrarCaja(db, adminId, "2030-05-11", ahora);
    expect(c11).toMatchObject({ jornada: "2030-05-11", turno: 1, total: 14000, cantidadFacturas: 1 });
    const porCierre = await db.select({ jornada: facturas.jornada, cierreId: facturas.cierreId }).from(facturas);
    expect(porCierre.filter((f) => f.cierreId === c10.id).every((f) => f.jornada === "2030-05-10")).toBe(true);
    expect(porCierre.filter((f) => f.cierreId === c11.id).every((f) => f.jornada === "2030-05-11")).toBe(true);
  });

  it("las ventas posteriores a un cierre van al turno siguiente y no alteran el cierre anterior", async () => {
    await facturarEn(bogota("2030-05-10T13:00:00"), [{ platoId: bandeja, cantidad: 1 }]);
    const turno1 = await cerrarCaja(db, adminId, "2030-05-10", bogota("2030-05-10T16:00:00"));

    await facturarEn(bogota("2030-05-10T19:00:00"), [{ platoId: jugo, cantidad: 3 }]);
    expect((await cajaAbierta(db)).jornadas[0]).toMatchObject({ jornada: "2030-05-10", total: 21000, siguienteTurno: 2 });
    const turno2 = await cerrarCaja(db, adminId, "2030-05-10", bogota("2030-05-10T23:00:00"));

    expect(turno2).toMatchObject({ jornada: "2030-05-10", turno: 2, total: 21000, cantidadFacturas: 1 });
    const cierres = await listarCierres(db);
    expect(cierres.map((c) => [c.jornada, c.turno, c.total, c.cantidadFacturas])).toEqual([
      ["2030-05-10", 2, 21000, 1],
      ["2030-05-10", 1, 32000, 1],
    ]);
    expect(cierres[1].id).toBe(turno1.id);
    const facturasTurno1 = await db.select().from(facturas);
    expect(facturasTurno1.filter((f) => f.cierreId === turno1.id).map((f) => f.total)).toEqual([32000]);
  });

  it("valida la jornada y no cierra si no hay pendientes", async () => {
    const ahora = bogota("2030-05-10T12:00:00");
    await expect(cerrarCaja(db, adminId, "10/05/2030", ahora)).rejects.toThrow(/inválida/);
    await expect(cerrarCaja(db, adminId, "2030-05-11", ahora)).rejects.toThrow(/futura/);
    await expect(cerrarCaja(db, adminId, "2030-05-10", ahora)).rejects.toThrow(/No hay facturas pendientes/);
  });

  it("dos cierres simultáneos de la misma jornada no duplican facturas", async () => {
    await facturarEn(bogota("2030-05-10T13:00:00"), [{ platoId: bandeja, cantidad: 1 }]);
    const ahora = bogota("2030-05-10T20:00:00");
    const r = await Promise.allSettled([cerrarCaja(db, adminId, "2030-05-10", ahora), cerrarCaja(db, adminId, "2030-05-10", ahora)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(cierresCaja)).toHaveLength(1);
  });

  it("la base de datos impide dos cierres con la misma jornada y turno", async () => {
    await db.insert(cierresCaja).values({ jornada: "2030-05-10", turno: 1, responsableId: adminId, total: 0, cantidadFacturas: 0 });
    await expect(
      db.insert(cierresCaja).values({ jornada: "2030-05-10", turno: 1, responsableId: adminId, total: 0, cantidadFacturas: 0 }),
    ).rejects.toThrow();
  });

  it("reporta ventas por jornada (cerrado y pendiente) y productos más vendidos", async () => {
    await facturarEn(bogota("2030-05-10T13:00:00"), [
      { platoId: bandeja, cantidad: 1 },
      { platoId: jugo, cantidad: 1 },
    ]);
    await cerrarCaja(db, adminId, "2030-05-10", bogota("2030-05-10T22:00:00"));
    await facturarEn(bogota("2030-05-10T22:30:00"), [{ platoId: jugo, cantidad: 2 }]);
    await facturarEn(bogota("2030-05-11T12:00:00"), [{ platoId: jugo, cantidad: 1 }]);
    await crearPedido(db, meseroId, { mesaId, items: [{ platoId: bandeja, cantidad: 5 }] }); // sin facturar

    const r = await reporteVentas(db, "2030-05-10", "2030-05-11");
    expect(r.ventasPorJornada).toEqual([
      { jornada: "2030-05-10", facturas: 2, total: 53000, cerrado: 39000, pendiente: 14000, turnos: 1 },
      { jornada: "2030-05-11", facturas: 1, total: 7000, cerrado: 0, pendiente: 7000, turnos: 0 },
    ]);
    expect(r.totalPeriodo).toBe(60000);
    expect(r.platosMasVendidos[0]).toMatchObject({ plato: "Jugo", cantidad: 4, total: 28000 });
    expect((await reporteVentas(db, "2030-05-11", "2030-05-11")).totalPeriodo).toBe(7000);
  });
});
