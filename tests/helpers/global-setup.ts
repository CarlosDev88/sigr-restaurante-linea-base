import { migrarBD } from "../../scripts/migrar";

export const URL_BD_PRUEBAS = "file:./data/test.db";

// Crea una base de datos SQLite limpia aplicando las migraciones versionadas.
export default async function setup() {
  await migrarBD(URL_BD_PRUEBAS, true);
}
