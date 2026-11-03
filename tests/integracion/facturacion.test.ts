import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { facturaItems, facturas, mesas, pedidos } from "@/lib/db/schema";
import { calcularFactura, ErrorNegocio, numeroFactura } from "@/lib/domain/reglas";
import { facturarPedido, obtenerFactura } from "@/lib/services/facturacion";
import { actualizarPlato, crearCategoria, crearPlato } from "@/lib/services/menu";
import { crearPedido } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";
import { pedidoEntregado } from "../helpers/pedidos";

const CONSUMIDOR = { tipoCliente: "CONSUMIDOR_FINAL", medioPago: "EFECTIVO" } as const;

describe("facturación", () => {
  let meseroId: number;
  let mesaId: number;
  let categoriaId: number;
  let bandeja: number;
  let limonada: number;
  const entregado = (items: { platoId: number; cantidad: number }[]) => pedidoEntregado(db, meseroId, mesaId, items);

  beforeEach(async () => {
    await limpiarBD();
    meseroId = (await crearUsuario("MESERO")).id;
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 3, capacidad: 4 }).returning();
    categoriaId = (await crearCategoria(db, { nombre: "Carta" })).id;
    bandeja = (await crearPlato(db, { nombre: "Bandeja paisa", precio: 32000, categoriaId })).id;
    limonada = (await crearPlato(db, { nombre: "Limonada de coco", precio: 9000, categoriaId })).id;
  });

  afterEach(() => {
    delete process.env.RESTAURANTE_RAZON_SOCIAL;
  });

  it("calcula importes en el servidor: total, base e impuesto al consumo incluido", () => {
    const v = calcularFactura(
      [
        { platoId: 1, nombrePlato: "A", precioUnitario: 32000, cantidad: 1 },
        { platoId: 2, nombrePlato: "B", precioUnitario: 9000, cantidad: 2 },
      ],
      8,
    );
    expect(v.total).toBe(50000);
    expect(v.subtotal).toBe(46296); // round(50000 / 1.08)
    expect(v.impuestoConsumo).toBe(3704);
    expect(v.subtotal + v.impuestoConsumo).toBe(v.total);
    expect(v.items.map((i) => i.valorTotal)).toEqual([32000, 18000]);
    expect(numeroFactura("FA", 12)).toBe("FA-000012");
  });

  it("emite facturas con numeración consecutiva única, detalle, emisor y total, y marca el pedido como pagado", async () => {
    const p1 = await entregado([
      { platoId: bandeja, cantidad: 1 },
      { platoId: limonada, cantidad: 2 },
    ]);
    const p2 = await entregado([{ platoId: limonada, cantidad: 1 }]);
    const f1 = await facturarPedido(db, p1, meseroId, CONSUMIDOR);
    const f2 = await facturarPedido(db, p2, meseroId, { ...CONSUMIDOR, medioPago: "TARJETA" });

    expect([f1.numero, f2.numero]).toEqual([1, 2]);
    expect(numeroFactura(f1.prefijo, f1.numero)).toBe("FA-000001");
    expect(f1).toMatchObject({
      total: 50000,
      subtotal: 46296,
      impuestoConsumo: 3704,
      tasaImpuestoConsumo: 8,
      clienteNombre: "Consumidor final",
      clienteNumeroDocumento: null,
      medioPago: "EFECTIVO",
      mesaNumero: 3,
      emisorRazonSocial: "SIGR Restaurante Académico S.A.S.",
      emisorNit: "900.000.000-0",
    });
    const detalle = await obtenerFactura(db, 1);
    expect(detalle?.items.map((i) => [i.descripcion, i.cantidad, i.valorUnitario, i.valorTotal])).toEqual([
      ["Bandeja paisa", 1, 32000, 32000],
      ["Limonada de coco", 2, 9000, 18000],
    ]);
    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, p1));
    expect(pedido.estado).toBe("PAGADO");
  });

  it("guarda los datos del cliente cuando se identifica y los valida", async () => {
    const p = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    await expect(
      facturarPedido(db, p, meseroId, {
        tipoCliente: "IDENTIFICADO",
        medioPago: "EFECTIVO",
        clienteTipoDocumento: "NIT",
        clienteNumeroDocumento: "1",
        clienteNombre: "Empresa",
      }),
    ).rejects.toBeInstanceOf(ZodError);

    const f = await facturarPedido(db, p, meseroId, {
      tipoCliente: "IDENTIFICADO",
      medioPago: "TRANSFERENCIA",
      clienteTipoDocumento: "NIT",
      clienteNumeroDocumento: "901234567-8",
      clienteNombre: "Comercializadora Ejemplo S.A.S.",
      clienteEmail: "",
    });
    expect(f).toMatchObject({
      clienteTipoDocumento: "NIT",
      clienteNumeroDocumento: "901234567-8",
      clienteNombre: "Comercializadora Ejemplo S.A.S.",
      clienteEmail: null,
      medioPago: "TRANSFERENCIA",
    });
  });

  it("conserva los datos históricos aunque cambien el menú o los datos del restaurante", async () => {
    const p = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    await facturarPedido(db, p, meseroId, CONSUMIDOR);

    await actualizarPlato(db, bandeja, { nombre: "Bandeja especial", precio: 45000, categoriaId });
    process.env.RESTAURANTE_RAZON_SOCIAL = "Otra Razón Social S.A.S.";
    const p2 = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    await facturarPedido(db, p2, meseroId, CONSUMIDOR);

    const f1 = await obtenerFactura(db, 1);
    const f2 = await obtenerFactura(db, 2);
    expect(f1).toMatchObject({ total: 32000, emisorRazonSocial: "SIGR Restaurante Académico S.A.S." });
    expect(f1?.items[0]).toMatchObject({ descripcion: "Bandeja paisa", valorUnitario: 32000 });
    expect(f2).toMatchObject({ total: 45000, emisorRazonSocial: "Otra Razón Social S.A.S." });
    expect(f2?.items[0].descripcion).toBe("Bandeja especial");
  });

  it("impide facturar dos veces el mismo pedido, también con solicitudes simultáneas", async () => {
    const p = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    const resultados = await Promise.allSettled([
      facturarPedido(db, p, meseroId, CONSUMIDOR),
      facturarPedido(db, p, meseroId, CONSUMIDOR),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason).toBeInstanceOf(ErrorNegocio);

    await expect(facturarPedido(db, p, meseroId, CONSUMIDOR)).rejects.toThrow(/ya fue facturado \(FA-000001\)/);
    expect(await db.select().from(facturas).where(eq(facturas.pedidoId, p))).toHaveLength(1);
    expect(await db.select().from(facturaItems)).toHaveLength(1);
  });

  it("la base de datos rechaza números o pedidos duplicados aunque se salte la lógica", async () => {
    const p = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    const f = await facturarPedido(db, p, meseroId, CONSUMIDOR);
    const p2 = await entregado([{ platoId: bandeja, cantidad: 1 }]);
    const { id: _id, ...copia } = f;
    await expect(db.insert(facturas).values({ ...copia, pedidoId: p2 })).rejects.toThrow(); // número repetido
    await expect(db.insert(facturas).values({ ...copia, numero: 99 })).rejects.toThrow(); // pedido repetido
  });

  it("solo factura pedidos entregados", async () => {
    const pendiente = await crearPedido(db, meseroId, { mesaId, items: [{ platoId: bandeja, cantidad: 1 }] });
    await expect(facturarPedido(db, pendiente.id, meseroId, CONSUMIDOR)).rejects.toThrow(/entregados/);
    await expect(facturarPedido(db, 9999, meseroId, CONSUMIDOR)).rejects.toThrow(/no existe/);
    expect(await db.select().from(facturas)).toHaveLength(0);
  });
});
