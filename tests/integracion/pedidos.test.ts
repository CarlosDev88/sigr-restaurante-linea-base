import { beforeEach, describe, expect, it } from "vitest";
import { ErrorNegocio } from "@/lib/domain/reglas";
import { mesas } from "@/lib/db/schema";
import { actualizarPlato, crearCategoria, crearPlato } from "@/lib/services/menu";
import { cambiarEstadoPedido, crearPedido, listarPedidosActivos } from "@/lib/services/pedidos";
import { crearUsuario, db, limpiarBD } from "../helpers/db";

describe("pedidos", () => {
  let meseroId: number;
  let mesaId: number;
  let categoriaId: number;
  let platoA: number;
  let platoB: number;

  beforeEach(async () => {
    await limpiarBD();
    meseroId = (await crearUsuario("MESERO")).id;
    [{ id: mesaId }] = await db.insert(mesas).values({ numero: 1, capacidad: 4 }).returning();
    categoriaId = (await crearCategoria(db, { nombre: "Fuertes" })).id;
    platoA = (await crearPlato(db, { nombre: "Bandeja paisa", precio: 32000, categoriaId })).id;
    platoB = (await crearPlato(db, { nombre: "Jugo", precio: 7000, categoriaId })).id;
  });

  it("registra el pedido con total y conserva el precio del momento", async () => {
    const pedido = await crearPedido(db, meseroId, {
      mesaId,
      items: [
        { platoId: platoA, cantidad: 1 },
        { platoId: platoB, cantidad: 2 },
        { platoId: platoB, cantidad: 1 }, // repetido: se agrupa
      ],
    });
    await actualizarPlato(db, platoA, { nombre: "Bandeja paisa", precio: 40000, categoriaId });

    const [activo] = await listarPedidosActivos(db);
    expect(activo.id).toBe(pedido.id);
    expect(activo.estado).toBe("PENDIENTE");
    expect(activo.total).toBe(32000 + 3 * 7000);
  });

  it("rechaza pedidos vacíos o con platos no disponibles", async () => {
    await expect(crearPedido(db, meseroId, { mesaId, items: [] })).rejects.toThrow();
    await actualizarPlato(db, platoB, { nombre: "Jugo", precio: 7000, categoriaId, disponible: false });
    await expect(crearPedido(db, meseroId, { mesaId, items: [{ platoId: platoB, cantidad: 1 }] })).rejects.toThrow(
      /no está disponible/,
    );
  });

  it("aplica solo transiciones válidas y saca del tablero los cancelados", async () => {
    const { id } = await crearPedido(db, meseroId, { mesaId, items: [{ platoId: platoA, cantidad: 1 }] });
    await expect(cambiarEstadoPedido(db, id, "ENTREGADO")).rejects.toBeInstanceOf(ErrorNegocio);
    await cambiarEstadoPedido(db, id, "EN_PREPARACION");
    await cambiarEstadoPedido(db, id, "ENTREGADO");
    await expect(cambiarEstadoPedido(db, id, "PAGADO")).rejects.toThrow(/comprobante/);
    expect((await listarPedidosActivos(db))[0].siguientes).toEqual(["PAGADO"]);

    const otro = await crearPedido(db, meseroId, { mesaId, items: [{ platoId: platoB, cantidad: 1 }] });
    await cambiarEstadoPedido(db, otro.id, "CANCELADO");
    expect((await listarPedidosActivos(db)).map((p) => p.id)).toEqual([id]);
  });
});
