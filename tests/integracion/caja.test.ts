import { beforeEach, describe, expect, it } from "vitest";
import { mesas } from "@/lib/db/schema";
import { cajaAbierta, cerrarCaja, listarCierres, reporteVentas } from "@/lib/services/caja";
import { facturarPedido } from "@/lib/services/facturacion";
import { crearCategoria, crearPlato } from "@/lib/services/menu";
import { crearPedido } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";
import { pedidoEntregado } from "../helpers/pedidos";

const CONSUMIDOR = { tipoCliente: "CONSUMIDOR_FINAL", medioPago: "EFECTIVO" } as const;

describe("caja y reportes", () => {
  let meseroId: number;
  let adminId: number;
  let mesaId: number;
  let bandeja: number;
  let jugo: number;
  const facturar = async (items: { platoId: number; cantidad: number }[]) =>
    facturarPedido(db, await pedidoEntregado(db, meseroId, mesaId, items), meseroId, CONSUMIDOR);

  beforeEach(async () => {
    await limpiarBD();
    meseroId = (await crearUsuario("MESERO")).id;
    adminId = (await crearUsuario("ADMIN")).id;
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 1, capacidad: 4 }).returning();
    const categoriaId = (await crearCategoria(db, { nombre: "Carta" })).id;
    bandeja = (await crearPlato(db, { nombre: "Bandeja paisa", precio: 32000, categoriaId })).id;
    jugo = (await crearPlato(db, { nombre: "Jugo", precio: 7000, categoriaId })).id;
  });

  it("guarda el cierre con responsable y total, y no cambia con ventas posteriores", async () => {
    await expect(cerrarCaja(db, adminId)).rejects.toThrow(/No hay facturas/);

    await facturar([{ platoId: bandeja, cantidad: 1 }]);
    await facturar([{ platoId: jugo, cantidad: 1 }]);
    expect((await cajaAbierta(db)).total).toBe(39000);

    const cierre = await cerrarCaja(db, adminId);
    expect(cierre).toMatchObject({ responsableId: adminId, total: 39000, cantidadFacturas: 2 });
    expect((await cajaAbierta(db)).facturas).toHaveLength(0);

    await facturar([{ platoId: jugo, cantidad: 3 }]);
    expect((await cajaAbierta(db)).total).toBe(21000);
    const [guardado] = await listarCierres(db);
    expect(guardado).toMatchObject({ id: cierre.id, total: 39000, cantidadFacturas: 2 });
  });

  it("reporta ventas por día y productos más vendidos a partir de las facturas", async () => {
    await facturar([
      { platoId: bandeja, cantidad: 1 },
      { platoId: jugo, cantidad: 1 },
    ]);
    await facturar([{ platoId: jugo, cantidad: 2 }]);
    await crearPedido(db, meseroId, { mesaId, items: [{ platoId: bandeja, cantidad: 5 }] }); // sin facturar: no cuenta

    const r = await reporteVentas(db, new Date(Date.now() - 86_400_000), new Date(Date.now() + 60_000));
    expect(r.totalPeriodo).toBe(32000 + 7000 + 14000);
    expect(r.ventasPorDia.reduce((s, d) => s + d.facturas, 0)).toBe(2);
    expect(r.platosMasVendidos[0]).toMatchObject({ plato: "Jugo", cantidad: 3, total: 21000 });
    expect(r.platosMasVendidos[1]).toMatchObject({ plato: "Bandeja paisa", cantidad: 1 });
  });
});
