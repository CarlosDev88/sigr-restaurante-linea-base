import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { BD } from "../db/cliente";
import { categorias, pedidoItems, platos } from "../db/schema";
import { ErrorNegocio } from "../domain/reglas";

export const esquemaCategoria = z.object({
  nombre: z.string().trim().min(2, { error: "El nombre de la categoría es muy corto." }).max(60),
});

export const esquemaPlato = z.object({
  nombre: z.string().trim().min(2, { error: "El nombre del plato es muy corto." }).max(80),
  descripcion: z.string().trim().max(200).default(""),
  precio: z.coerce
    .number({ error: "Precio inválido." })
    .int({ error: "El precio debe ser un valor entero en pesos." })
    .positive({ error: "El precio debe ser mayor que cero." })
    .max(10_000_000),
  categoriaId: z.coerce.number().int().positive({ error: "Seleccione una categoría." }),
  disponible: z.boolean().default(true),
});

export type DatosPlato = z.input<typeof esquemaPlato>;

export async function listarMenu(bd: BD, { soloDisponibles }: { soloDisponibles: boolean }) {
  const lista = await bd.query.categorias.findMany({
    orderBy: asc(categorias.nombre),
    with: {
      platos: {
        where: soloDisponibles ? eq(platos.disponible, true) : undefined,
        orderBy: asc(platos.nombre),
      },
    },
  });
  return soloDisponibles ? lista.filter((c) => c.platos.length > 0) : lista;
}

export async function crearCategoria(bd: BD, datos: unknown) {
  const { nombre } = esquemaCategoria.parse(datos);
  const [existe] = await bd.select().from(categorias).where(eq(categorias.nombre, nombre));
  if (existe) throw new ErrorNegocio(`Ya existe la categoría "${nombre}".`);
  const [c] = await bd.insert(categorias).values({ nombre }).returning();
  return c;
}

export async function eliminarCategoria(bd: BD, id: number) {
  const asociados = await bd.select({ id: platos.id }).from(platos).where(eq(platos.categoriaId, id));
  if (asociados.length > 0) {
    throw new ErrorNegocio("No se puede eliminar una categoría que tiene platos.");
  }
  await bd.delete(categorias).where(eq(categorias.id, id));
}

async function validarCategoria(bd: BD, categoriaId: number) {
  const [c] = await bd.select().from(categorias).where(eq(categorias.id, categoriaId));
  if (!c) throw new ErrorNegocio("La categoría no existe.");
}

export async function crearPlato(bd: BD, datos: DatosPlato) {
  const plato = esquemaPlato.parse(datos);
  await validarCategoria(bd, plato.categoriaId);
  const [p] = await bd.insert(platos).values(plato).returning();
  return p;
}

export async function actualizarPlato(bd: BD, id: number, datos: DatosPlato) {
  const plato = esquemaPlato.parse(datos);
  await validarCategoria(bd, plato.categoriaId);
  const [p] = await bd.update(platos).set(plato).where(eq(platos.id, id)).returning();
  if (!p) throw new ErrorNegocio("El plato no existe.");
  return p;
}

/** Un plato que ya aparece en pedidos no se borra (se perdería trazabilidad): se marca no disponible. */
export async function eliminarPlato(bd: BD, id: number) {
  const usado = await bd.select({ id: pedidoItems.id }).from(pedidoItems).where(eq(pedidoItems.platoId, id)).limit(1);
  if (usado.length > 0) {
    throw new ErrorNegocio("El plato ya tiene pedidos registrados; márquelo como no disponible.");
  }
  await bd.delete(platos).where(eq(platos.id, id));
}
