// Aplica las migraciones versionadas de ./drizzle a la base de datos indicada en DATABASE_URL.
// Uso: npm run db:migrate            (aplica migraciones pendientes)
//      npm run db:migrate -- --reset (borra el archivo SQLite y lo crea de nuevo)
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { crearBD, URL_BD_POR_DEFECTO } from "../src/lib/db/cliente";

export async function migrarBD(url: string, reiniciar = false) {
  if (url.startsWith("file:")) {
    const archivo = path.resolve(url.slice("file:".length));
    mkdirSync(path.dirname(archivo), { recursive: true });
    if (reiniciar) {
      for (const sufijo of ["", "-journal", "-wal", "-shm"]) {
        if (existsSync(archivo + sufijo)) rmSync(archivo + sufijo);
      }
    }
  }
  const bd = crearBD(url);
  await migrate(bd, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  bd.$client.close();
}

if (require.main === module) {
  const url = process.env.DATABASE_URL ?? URL_BD_POR_DEFECTO;
  migrarBD(url, process.argv.includes("--reset"))
    .then(() => console.log(`Migraciones aplicadas en ${url}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
