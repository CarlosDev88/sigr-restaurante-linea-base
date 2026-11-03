"use server";

import { revalidatePath } from "next/cache";
import { aEstadoError, type EstadoAccion } from "@/lib/acciones";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { actualizarPlato, crearCategoria, crearPlato, eliminarCategoria, eliminarPlato } from "@/lib/services/menu";

function refrescar() {
  revalidatePath("/admin/menu");
  revalidatePath("/menu");
}

function datosPlato(f: FormData) {
  return {
    nombre: String(f.get("nombre") ?? ""),
    descripcion: String(f.get("descripcion") ?? ""),
    precio: f.get("precio"),
    categoriaId: f.get("categoriaId"),
    disponible: f.get("disponible") === "on",
  };
}

export async function accionCrearCategoria(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarMenu);
  try {
    await crearCategoria(db, { nombre: f.get("nombre") });
    refrescar();
    return { mensaje: "Categoría creada." };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionEliminarCategoria(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarMenu);
  try {
    await eliminarCategoria(db, Number(f.get("id")));
    refrescar();
    return { mensaje: "Categoría eliminada." };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionCrearPlato(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarMenu);
  try {
    await crearPlato(db, datosPlato(f));
    refrescar();
    return { mensaje: "Plato creado." };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionActualizarPlato(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarMenu);
  try {
    await actualizarPlato(db, Number(f.get("id")), datosPlato(f));
    refrescar();
    return { mensaje: "Guardado." };
  } catch (e) {
    return aEstadoError(e);
  }
}

export async function accionEliminarPlato(_: EstadoAccion, f: FormData): Promise<EstadoAccion> {
  await exigirRol(PERMISOS.administrarMenu);
  try {
    await eliminarPlato(db, Number(f.get("id")));
    refrescar();
    return { mensaje: "Plato eliminado." };
  } catch (e) {
    return aEstadoError(e);
  }
}
