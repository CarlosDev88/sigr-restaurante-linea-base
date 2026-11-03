import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type BD = LibSQLDatabase<typeof schema> & { $client: Client };

/** URL por defecto: archivo SQLite en ./data (relativo a la raíz del proyecto). */
export const URL_BD_POR_DEFECTO = "file:./data/sigr.db";

export function crearBD(url: string = process.env.DATABASE_URL ?? URL_BD_POR_DEFECTO): BD {
  const cliente = createClient({ url });
  return drizzle(cliente, { schema });
}
