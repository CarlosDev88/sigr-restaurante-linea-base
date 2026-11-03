// Datos iniciales para desarrollo y pruebas E2E. Es idempotente: no duplica registros.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { crearBD, URL_BD_POR_DEFECTO, type BD } from "../src/lib/db/cliente";
import { categorias, mesas, platos, usuarios } from "../src/lib/db/schema";
import type { Rol } from "../src/lib/domain/constantes";

export const USUARIOS_DEMO: { nombre: string; email: string; password: string; rol: Rol }[] = [
  { nombre: "Administrador", email: "admin@sigr.local", password: "Admin123*", rol: "ADMIN" },
  { nombre: "Mesero Uno", email: "mesero@sigr.local", password: "Mesero123*", rol: "MESERO" },
  { nombre: "Cliente Demo", email: "cliente@sigr.local", password: "Cliente123*", rol: "CLIENTE" },
];

const MESAS = [
  { numero: 1, capacidad: 2 },
  { numero: 2, capacidad: 2 },
  { numero: 3, capacidad: 4 },
  { numero: 4, capacidad: 4 },
  { numero: 5, capacidad: 6 },
  { numero: 6, capacidad: 8 },
];

const MENU: Record<string, { nombre: string; descripcion: string; precio: number }[]> = {
  Entradas: [
    { nombre: "Empanadas (3 und)", descripcion: "Con ají casero", precio: 9000 },
    { nombre: "Patacones con hogao", descripcion: "", precio: 12000 },
  ],
  "Platos fuertes": [
    { nombre: "Bandeja paisa", descripcion: "Frijol, arroz, carne, chicharrón y huevo", precio: 32000 },
    { nombre: "Mute santandereano", descripcion: "Sopa tradicional", precio: 26000 },
    { nombre: "Pechuga a la plancha", descripcion: "Con ensalada y papa", precio: 24000 },
  ],
  Bebidas: [
    { nombre: "Limonada de coco", descripcion: "", precio: 9000 },
    { nombre: "Jugo natural", descripcion: "En agua o leche", precio: 7000 },
  ],
  Postres: [{ nombre: "Brownie con helado", descripcion: "", precio: 11000 }],
};

export async function sembrar(bd: BD) {
  for (const u of USUARIOS_DEMO) {
    await bd
      .insert(usuarios)
      .values({ nombre: u.nombre, email: u.email, rol: u.rol, passwordHash: await bcrypt.hash(u.password, 10) })
      .onConflictDoNothing();
  }
  await bd.insert(mesas).values(MESAS).onConflictDoNothing();
  for (const [nombre, lista] of Object.entries(MENU)) {
    await bd.insert(categorias).values({ nombre }).onConflictDoNothing();
    const [categoria] = await bd.select().from(categorias).where(eq(categorias.nombre, nombre));
    const existentes = await bd.select().from(platos).where(eq(platos.categoriaId, categoria.id));
    if (existentes.length === 0) {
      await bd.insert(platos).values(lista.map((p) => ({ ...p, categoriaId: categoria.id })));
    }
  }
}

if (require.main === module) {
  const bd = crearBD(process.env.DATABASE_URL ?? URL_BD_POR_DEFECTO);
  sembrar(bd)
    .then(() => console.log("Datos iniciales cargados."))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => bd.$client.close());
}
