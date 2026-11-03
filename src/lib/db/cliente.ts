import { createClient, type Client, type InStatement, type Transaction } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type BD = LibSQLDatabase<typeof schema> & { $client: Client };

/** URL por defecto: archivo SQLite en ./data (relativo a la raíz del proyecto). */
export const URL_BD_POR_DEFECTO = "file:./data/sigr.db";

/** Cerrojo asíncrono: un solo escritor a la vez dentro del proceso, en orden de llegada. */
class CerrojoEscritura {
  private cola: Promise<void> = Promise.resolve();
  adquirir(): Promise<() => void> {
    let liberar!: () => void;
    const turno = new Promise<void>((r) => (liberar = r));
    const anterior = this.cola;
    this.cola = anterior.then(() => turno);
    return anterior.then(() => {
      let liberado = false;
      return () => {
        if (!liberado) {
          liberado = true;
          liberar();
        }
      };
    });
  }
}

const esLectura = (s: InStatement) => /^\s*(select|pragma)\b/i.test(typeof s === "string" ? s : s.sql);

/**
 * SQLite admite un único escritor. El cliente libsql ejecuta cada sentencia de forma síncrona,
 * pero una transacción mantiene el bloqueo de escritura entre `await`s; si otra operación intenta
 * escribir en ese momento, SQLite responde SQLITE_BUSY. Este envoltorio hace que las transacciones
 * y las escrituras del proceso esperen su turno (de forma asíncrona, sin bloquear el event loop).
 * Las lecturas no esperan.
 */
function serializarEscrituras(cliente: Client): Client {
  const cerrojo = new CerrojoEscritura();
  const conCerrojo =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      const liberar = await cerrojo.adquirir();
      try {
        return await fn(...a);
      } finally {
        liberar();
      }
    };

  return new Proxy(cliente, {
    get(objetivo, prop, receptor) {
      if (prop === "execute") {
        const ejecutar = objetivo.execute.bind(objetivo) as (...a: unknown[]) => Promise<unknown>;
        return (...a: unknown[]) =>
          esLectura(a[0] as InStatement) ? ejecutar(...a) : conCerrojo(() => ejecutar(...a))();
      }
      if (prop === "batch" || prop === "executeMultiple" || prop === "migrate") {
        const original = Reflect.get(objetivo, prop, receptor) as (...a: unknown[]) => Promise<unknown>;
        return conCerrojo((...a: unknown[]) => original.apply(objetivo, a));
      }
      if (prop === "transaction") {
        return async (...a: Parameters<Client["transaction"]>): Promise<Transaction> => {
          const liberar = await cerrojo.adquirir();
          let tx: Transaction;
          try {
            tx = await objetivo.transaction(...a);
          } catch (e) {
            liberar();
            throw e;
          }
          return new Proxy(tx, {
            get(t, p, r) {
              const valor = Reflect.get(t, p, r);
              if (p === "commit" || p === "rollback") {
                return async () => {
                  try {
                    return await (valor as () => Promise<void>).call(t);
                  } finally {
                    liberar();
                  }
                };
              }
              if (p === "close") {
                return () => {
                  try {
                    (valor as () => void).call(t);
                  } finally {
                    liberar();
                  }
                };
              }
              return typeof valor === "function" ? valor.bind(t) : valor;
            },
          });
        };
      }
      const valor = Reflect.get(objetivo, prop, receptor);
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}

export function crearBD(url: string = process.env.DATABASE_URL ?? URL_BD_POR_DEFECTO): BD {
  // timeout: si OTRO proceso (p. ej. un script de migración) bloquea el archivo, espera hasta 5 s.
  const cliente = serializarEscrituras(createClient({ url, timeout: 5000 }));
  return drizzle(cliente, { schema });
}
