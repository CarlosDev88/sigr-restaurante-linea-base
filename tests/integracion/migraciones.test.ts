// Verifica que una base de datos creada con la v1.0.0 (con comprobantes y cierres) se actualiza
// sin perder información al aplicar las migraciones de la versión actual.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { crearBD } from "@/lib/db/cliente";
import { cierresCaja, facturaItems, facturas } from "@/lib/db/schema";

const CARPETA = path.resolve(__dirname, "../../drizzle");
const temporal = mkdtempSync(path.join(os.tmpdir(), "sigr-migr-"));
const ARCHIVO_BD = path.join(temporal, "migracion.db");

afterAll(() => rmSync(temporal, { recursive: true, force: true }));

/** Copia de la carpeta de migraciones con el diario recortado a las primeras `n`. */
function migracionesHasta(n: number) {
  const destino = path.join(temporal, `drizzle-${n}`);
  cpSync(CARPETA, destino, { recursive: true });
  const diario = JSON.parse(readFileSync(path.join(destino, "meta/_journal.json"), "utf8"));
  diario.entries = diario.entries.slice(0, n);
  writeFileSync(path.join(destino, "meta/_journal.json"), JSON.stringify(diario));
  return destino;
}

describe("migraciones v1.0.0 → actual", () => {
  it("convierte comprobantes en facturas conservando número, total, detalle y cierre, y completa las jornadas", async () => {
    const bd = crearBD(`file:${ARCHIVO_BD}`);
    await migrate(bd, { migrationsFolder: migracionesHasta(1) }); // solo 0000_init (esquema v1.0.0)

    const c = bd.$client;
    await c.executeMultiple(`
      INSERT INTO usuarios (id, nombre, email, password_hash, rol) VALUES (1, 'Mesero', 'm@x.co', 'x', 'MESERO'), (2, 'Admin', 'a@x.co', 'x', 'ADMIN');
      INSERT INTO mesas (id, numero, capacidad) VALUES (1, 5, 4);
      INSERT INTO categorias (id, nombre) VALUES (1, 'Carta');
      INSERT INTO platos (id, nombre, precio, categoria_id) VALUES (1, 'Bandeja paisa', 32000, 1), (2, 'Jugo', 7000, 1);
      INSERT INTO pedidos (id, mesa_id, mesero_id, estado) VALUES (1, 1, 1, 'PAGADO'), (2, 1, 1, 'PAGADO');
      INSERT INTO pedido_items (pedido_id, plato_id, nombre_plato, precio_unitario, cantidad) VALUES (1, 1, 'Bandeja paisa', 32000, 1), (1, 2, 'Jugo', 7000, 2), (2, 2, 'Jugo', 7000, 1);
      INSERT INTO cierres_caja (id, fecha_hora, responsable_id, total, cantidad_comprobantes) VALUES (1, 1893456000000, 2, 46000, 1);
      INSERT INTO comprobantes (id, numero, pedido_id, total, emitido_en, emitido_por_id, cierre_id) VALUES (1, 1, 1, 46000, 1893452400000, 1, 1), (2, 2, 2, 7000, 1893460000000, 1, NULL);
    `);

    await migrate(bd, { migrationsFolder: CARPETA }); // resto de migraciones

    const lista = await bd.select().from(facturas).orderBy(facturas.numero);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({
      numero: 1,
      pedidoId: 1,
      total: 46000,
      subtotal: 42593, // round(46000 / 1.08)
      impuestoConsumo: 3407,
      medioPago: "NO_REGISTRADO",
      clienteNombre: "Consumidor final",
      mesaNumero: 5,
      cierreId: 1,
      jornada: "2029-12-31", // 2029-12-31T23:00Z = 18:00 en Bogotá
    });
    expect(lista[1]).toMatchObject({ numero: 2, total: 7000, cierreId: null, jornada: "2029-12-31" }); // 01:06Z del 1 ene = 20:06 del 31 dic en Bogotá
    const items = await bd.select().from(facturaItems).orderBy(facturaItems.id);
    expect(items.map((i) => [i.facturaId, i.descripcion, i.valorTotal])).toEqual([
      [lista[0].id, "Bandeja paisa", 32000],
      [lista[0].id, "Jugo", 14000],
      [lista[1].id, "Jugo", 7000],
    ]);
    const [cierre] = await bd.select().from(cierresCaja);
    expect(cierre).toMatchObject({ total: 46000, cantidadFacturas: 1, jornada: "2029-12-31", turno: 1 });
    const tablas = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='comprobantes'");
    expect(tablas.rows).toHaveLength(0);
    c.close();
  });
});
