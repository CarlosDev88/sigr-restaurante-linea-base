import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { BD } from "../db/cliente";
import { cierresCaja, facturaItems, facturas } from "../db/schema";
import { diaBogota, ErrorNegocio } from "../domain/reglas";

/**
 * Cierre de caja diario por jornada y turno.
 *
 * - Jornada: día calendario en hora de Bogotá (00:00–23:59, UTC-5). Cada factura pertenece a la
 *   jornada en que se emitió y nunca cambia de jornada.
 * - Turno: cada cierre de una jornada recibe el siguiente número de turno (1, 2, …). Un cierre
 *   agrupa solo las facturas PENDIENTES DE ESA jornada; jamás mezcla jornadas distintas.
 * - Las ventas posteriores a un cierre quedan pendientes para el siguiente turno; los cierres
 *   ya registrados no se modifican.
 */

const FORMATO_JORNADA = /^\d{4}-\d{2}-\d{2}$/;

export interface JornadaPendiente {
  jornada: string;
  facturas: (typeof facturas.$inferSelect)[];
  total: number;
  siguienteTurno: number;
}

/** Facturas sin cierre, agrupadas por jornada (de la más antigua a la más reciente). */
export async function cajaAbierta(bd: BD): Promise<{ jornadas: JornadaPendiente[]; total: number }> {
  const pendientes = await bd
    .select()
    .from(facturas)
    .where(isNull(facturas.cierreId))
    .orderBy(asc(facturas.jornada), asc(facturas.numero));
  const turnos = await bd
    .select({ jornada: cierresCaja.jornada, ultimo: sql<number>`max(${cierresCaja.turno})` })
    .from(cierresCaja)
    .groupBy(cierresCaja.jornada);
  const ultimoTurno = new Map(turnos.map((t) => [t.jornada, t.ultimo]));

  const jornadas = new Map<string, JornadaPendiente>();
  for (const f of pendientes) {
    const j = jornadas.get(f.jornada) ?? {
      jornada: f.jornada,
      facturas: [],
      total: 0,
      siguienteTurno: (ultimoTurno.get(f.jornada) ?? 0) + 1,
    };
    j.facturas.push(f);
    j.total += f.total;
    jornadas.set(f.jornada, j);
  }
  const lista = [...jornadas.values()];
  return { jornadas: lista, total: lista.reduce((s, j) => s + j.total, 0) };
}

/** Registra el cierre del siguiente turno de una jornada con sus facturas pendientes. */
export async function cerrarCaja(bd: BD, responsableId: number, jornada: string, ahora: Date = new Date()) {
  if (!FORMATO_JORNADA.test(jornada)) throw new ErrorNegocio("Jornada inválida (AAAA-MM-DD).");
  if (jornada > diaBogota(ahora)) throw new ErrorNegocio("No se puede cerrar una jornada futura.");

  return bd.transaction(async (tx) => {
    const pendientes = await tx
      .select()
      .from(facturas)
      .where(and(eq(facturas.jornada, jornada), isNull(facturas.cierreId)));
    if (pendientes.length === 0) {
      throw new ErrorNegocio(`No hay facturas pendientes de cierre en la jornada ${jornada}.`);
    }
    const [{ ultimo }] = await tx
      .select({ ultimo: sql<number>`coalesce(max(${cierresCaja.turno}), 0)` })
      .from(cierresCaja)
      .where(eq(cierresCaja.jornada, jornada));

    const [cierre] = await tx
      .insert(cierresCaja)
      .values({
        jornada,
        turno: ultimo + 1,
        fechaHora: ahora,
        responsableId,
        total: pendientes.reduce((s, f) => s + f.total, 0),
        cantidadFacturas: pendientes.length,
      })
      .returning();
    const asignadas = await tx
      .update(facturas)
      .set({ cierreId: cierre.id })
      .where(
        and(
          inArray(
            facturas.id,
            pendientes.map((f) => f.id),
          ),
          isNull(facturas.cierreId),
        ),
      )
      .returning({ id: facturas.id });
    if (asignadas.length !== pendientes.length) throw new ErrorNegocio("La caja cambió durante el cierre; intente de nuevo.");
    return cierre;
  });
}

export async function listarCierres(bd: BD, limite = 30) {
  return bd.query.cierresCaja.findMany({
    orderBy: [desc(cierresCaja.jornada), desc(cierresCaja.turno)],
    limit: limite,
    with: { responsable: { columns: { nombre: true } } },
  });
}

/**
 * Reporte por jornada (inclusive) a partir de las facturas: ventas, parte cerrada y pendiente,
 * turnos cerrados y productos más vendidos.
 */
export async function reporteVentas(bd: BD, desdeJornada: string, hastaJornada: string) {
  const enRango = and(gte(facturas.jornada, desdeJornada), lte(facturas.jornada, hastaJornada));

  const porJornada = await bd
    .select({
      jornada: facturas.jornada,
      facturas: sql<number>`count(*)`,
      total: sql<number>`sum(${facturas.total})`,
      cerrado: sql<number>`coalesce(sum(case when ${facturas.cierreId} is not null then ${facturas.total} end), 0)`,
      turnos: sql<number>`count(distinct ${facturas.cierreId})`,
    })
    .from(facturas)
    .where(enRango)
    .groupBy(facturas.jornada)
    .orderBy(asc(facturas.jornada));

  const cantidad = sql<number>`sum(${facturaItems.cantidad})`;
  const platosMasVendidos = await bd
    .select({ plato: facturaItems.descripcion, cantidad, total: sql<number>`sum(${facturaItems.valorTotal})` })
    .from(facturaItems)
    .innerJoin(facturas, eq(facturas.id, facturaItems.facturaId))
    .where(enRango)
    .groupBy(facturaItems.descripcion)
    .orderBy(desc(cantidad), asc(facturaItems.descripcion))
    .limit(10);

  const ventasPorJornada = porJornada.map((j) => ({ ...j, pendiente: j.total - j.cerrado }));
  return {
    ventasPorJornada,
    totalPeriodo: ventasPorJornada.reduce((s, j) => s + j.total, 0),
    platosMasVendidos,
  };
}
