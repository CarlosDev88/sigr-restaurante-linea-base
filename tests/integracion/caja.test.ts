import { beforeEach, describe, expect, it } from "vitest";
import { mesas } from "@/lib/db/schema";
import { cajaAbierta, cerrarCaja, listarCierres, obtenerComprobante, pagarPedido, reporteVentas } from "@/lib/services/caja";
import { crearCategoria, crearPlato } from "@/lib/services/menu";
import { cambiarEstadoPedido, crearPedido } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";

describe("caja, comprobantes y reportes", () => {
  let meseroId: number;
  let adminId: number;
  let mesaId: number;
  let bandeja: number;
  let jugo: number;

  /** Crea un pedido y lo lleva hasta ENTREGADO. */
  async function pedidoEntregado(items: { platoId: number; cantidad: number }[]) {
    const p = await crearPedido(db, meseroId, { mesaId, items });
    await cambiarEstadoPedido(db, p.id, "EN_PREPARACION");
    await cambiarEstadoPedido(db, p.id, "ENTREGADO");
    return p.id;
  }

  beforeEach(async () => {
    await limpiarBD();
    meseroId = (await crearUsuario("MESERO")).id;
    adminId = (await crearUsuario("ADMIN")).id;
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 1, capacidad: 4 }).returning();
    const categoriaId = (await crearCategoria(db, { nombre: "Carta" })).id;
    bandeja = (await crearPlato(db, { nombre: "Bandeja paisa", precio: 32000, categoriaId })).id;
    jugo = (await crearPlato(db, { nombre: "Jugo", precio: 7000, categoriaId })).id;
  });

  it("emite comprobantes consecutivos con detalle y total, solo para pedidos entregados", async () => {
    const enCurso = await crearPedido(db, meseroId, { mesaId, items: [{ platoId: jugo, cantidad: 1 }] });
    await expect(pagarPedido(db, enCurso.id, meseroId)).rejects.toThrow(/entregados/);

    const c1 = await pagarPedido(db, await pedidoEntregado([{ platoId: bandeja, cantidad: 1 }, { platoId: jugo, cantidad: 2 }]), meseroId);
    const c2 = await pagarPedido(db, await pedidoEntregado([{ platoId: jugo, cantidad: 1 }]), meseroId);
    expect([c1.numero, c2.numero]).toEqual([1, 2]);
    expect(c1.total).toBe(46000);
    await expect(pagarPedido(db, c1.pedidoId, meseroId)).rejects.toThrow(/ya fue pagado/);

    const detalle = await obtenerComprobante(db, 1);
    expect(detalle?.pedido.estado).toBe("PAGADO");
    expect(detalle?.pedido.items.map((i) => [i.nombrePlato, i.cantidad])).toEqual([
      ["Bandeja paisa", 1],
      ["Jugo", 2],
    ]);
  });

  it("guarda el cierre con responsable y total, y no cambia con ventas posteriores", async () => {
    await expect(cerrarCaja(db, adminId)).rejects.toThrow(/No hay comprobantes/);

    await pagarPedido(db, await pedidoEntregado([{ platoId: bandeja, cantidad: 1 }]), meseroId);
    await pagarPedido(db, await pedidoEntregado([{ platoId: jugo, cantidad: 1 }]), meseroId);
    expect((await cajaAbierta(db)).total).toBe(39000);

    const cierre = await cerrarCaja(db, adminId);
    expect(cierre).toMatchObject({ responsableId: adminId, total: 39000, cantidadComprobantes: 2 });
    expect((await cajaAbierta(db)).comprobantes).toHaveLength(0);

    // Una venta posterior queda en la caja abierta, no altera el cierre anterior.
    await pagarPedido(db, await pedidoEntregado([{ platoId: jugo, cantidad: 3 }]), meseroId);
    expect((await cajaAbierta(db)).total).toBe(21000);
    const [guardado] = await listarCierres(db);
    expect(guardado).toMatchObject({ id: cierre.id, total: 39000, cantidadComprobantes: 2 });
    expect(guardado.responsable.nombre).toBe("Usuario ADMIN");
  });

  it("reporta ventas por día y platos más vendidos", async () => {
    await pagarPedido(db, await pedidoEntregado([{ platoId: bandeja, cantidad: 1 }, { platoId: jugo, cantidad: 1 }]), meseroId);
    await pagarPedido(db, await pedidoEntregado([{ platoId: jugo, cantidad: 2 }]), meseroId);
    await crearPedido(db, meseroId, { mesaId, items: [{ platoId: bandeja, cantidad: 5 }] }); // no pagado: no cuenta

    const r = await reporteVentas(db, new Date(Date.now() - 86_400_000), new Date(Date.now() + 60_000));
    expect(r.totalPeriodo).toBe(32000 + 7000 + 14000);
    expect(r.ventasPorDia.reduce((s, d) => s + d.comprobantes, 0)).toBe(2);
    expect(r.platosMasVendidos[0]).toMatchObject({ plato: "Jugo", cantidad: 3, total: 21000 });
    expect(r.platosMasVendidos[1]).toMatchObject({ plato: "Bandeja paisa", cantidad: 1 });
  });
});
