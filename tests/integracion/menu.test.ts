import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { ErrorNegocio } from "@/lib/domain/reglas";
import { actualizarPlato, crearCategoria, crearPlato, eliminarCategoria, listarMenu } from "@/lib/services/menu";
import { db, limpiarBD } from "../helpers/db";

describe("menú digital", () => {
  let categoriaId: number;

  beforeEach(async () => {
    await limpiarBD();
    categoriaId = (await crearCategoria(db, { nombre: "Bebidas" })).id;
  });

  it("crea, actualiza y lista platos", async () => {
    const p = await crearPlato(db, { nombre: "Limonada", precio: "8000", categoriaId });
    await actualizarPlato(db, p.id, { nombre: "Limonada de coco", precio: 9000, categoriaId, disponible: false });
    const completo = await listarMenu(db, { soloDisponibles: false });
    expect(completo[0].platos[0]).toMatchObject({ nombre: "Limonada de coco", precio: 9000, disponible: false });
    // el menú público oculta platos no disponibles y categorías vacías
    expect(await listarMenu(db, { soloDisponibles: true })).toHaveLength(0);
  });

  it("valida precio y categoría", async () => {
    await expect(crearPlato(db, { nombre: "Gratis", precio: 0, categoriaId })).rejects.toBeInstanceOf(ZodError);
    await expect(crearPlato(db, { nombre: "Decimal", precio: 10.5, categoriaId })).rejects.toBeInstanceOf(ZodError);
    await expect(crearPlato(db, { nombre: "Huérfano", precio: 1000, categoriaId: 9999 })).rejects.toBeInstanceOf(ErrorNegocio);
  });

  it("no duplica categorías ni elimina una categoría con platos", async () => {
    await expect(crearCategoria(db, { nombre: "Bebidas" })).rejects.toThrow(/Ya existe/);
    await crearPlato(db, { nombre: "Jugo", precio: 7000, categoriaId });
    await expect(eliminarCategoria(db, categoriaId)).rejects.toThrow(/tiene platos/);
  });
});
