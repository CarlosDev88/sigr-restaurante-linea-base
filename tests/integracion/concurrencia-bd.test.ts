import { beforeEach, describe, expect, it } from "vitest";
import { categorias, mesas } from "@/lib/db/schema";
import { db, limpiarBD } from "../helpers/db";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("escrituras concurrentes sobre SQLite", () => {
  beforeEach(limpiarBD);

  it("una escritura simultánea a una transacción abierta espera su turno en vez de fallar con SQLITE_BUSY", async () => {
    const orden: string[] = [];
    const transaccion = db.transaction(async (tx) => {
      await tx.insert(mesas).values({ numero: 1, capacidad: 2 });
      orden.push("tx-inicio");
      await esperar(50); // la transacción conserva el bloqueo de escritura entre awaits
      await tx.insert(mesas).values({ numero: 2, capacidad: 2 });
      orden.push("tx-fin");
    });
    const escrituraSuelta = (async () => {
      await esperar(10);
      await db.insert(categorias).values({ nombre: "Concurrente" });
      orden.push("escritura");
    })();
    // El event loop no queda bloqueado mientras se espera el turno.
    const temporizador = (async () => {
      await esperar(20);
      orden.push("temporizador");
    })();

    await Promise.all([transaccion, escrituraSuelta, temporizador]);
    expect(orden).toEqual(["tx-inicio", "temporizador", "tx-fin", "escritura"]);
    expect(await db.select().from(mesas)).toHaveLength(2);
    expect(await db.select().from(categorias)).toHaveLength(1);
  });

  it("si la transacción falla, se revierte y libera el turno", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(mesas).values({ numero: 1, capacidad: 2 });
        throw new Error("falla intencional");
      }),
    ).rejects.toThrow("falla intencional");
    await db.insert(mesas).values({ numero: 3, capacidad: 2 });
    expect((await db.select().from(mesas)).map((m) => m.numero)).toEqual([3]);
  });
});
