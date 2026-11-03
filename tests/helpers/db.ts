import bcrypt from "bcryptjs";
import { crearBD } from "@/lib/db/cliente";
import * as t from "@/lib/db/schema";
import type { Rol } from "@/lib/domain/constantes";

export const db = crearBD("file:./data/test.db");

/** Borra todos los datos respetando las llaves foráneas. */
export async function limpiarBD() {
  for (const tabla of [
    t.comprobantes,
    t.cierresCaja,
    t.pedidoItems,
    t.pedidos,
    t.reservas,
    t.platos,
    t.categorias,
    t.mesas,
    t.usuarios,
  ]) {
    await db.delete(tabla);
  }
}

export async function crearUsuario(rol: Rol, email = `${rol.toLowerCase()}@test.local`, password = "Clave123*") {
  const [u] = await db
    .insert(t.usuarios)
    .values({ nombre: `Usuario ${rol}`, email, rol, passwordHash: await bcrypt.hash(password, 4) })
    .returning();
  return u;
}
