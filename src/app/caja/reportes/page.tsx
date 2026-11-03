import Link from "next/link";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { OFFSET_BOGOTA } from "@/lib/domain/constantes";
import { diaBogota, formatoCOP } from "@/lib/domain/reglas";
import { reporteVentas } from "@/lib/services/caja";

const PERIODOS = [1, 7, 30];

export default async function Reportes({ searchParams }: PageProps<"/caja/reportes">) {
  await exigirRol(PERMISOS.caja);
  const { dias: param } = await searchParams;
  const dias = PERIODOS.includes(Number(param)) ? Number(param) : 7;

  // Desde el inicio del día (hora de Bogotá) de hace `dias - 1` días hasta ahora.
  const hoy = new Date(`${diaBogota(new Date())}T00:00:00${OFFSET_BOGOTA}`);
  const desde = new Date(hoy.getTime() - (dias - 1) * 86_400_000);
  const reporte = await reporteVentas(db, desde, new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="titulo mb-0 flex-1">Reporte de ventas</h1>
        {PERIODOS.map((d) => (
          <Link key={d} href={`/caja/reportes?dias=${d}`} className={d === dias ? "btn" : "btn-sec"}>
            {d === 1 ? "Hoy" : `Últimos ${d} días`}
          </Link>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Ventas diarias</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Día</th>
              <th>Comprobantes</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {reporte.ventasPorDia.length === 0 && (
              <tr>
                <td colSpan={3}>Sin ventas en el periodo.</td>
              </tr>
            )}
            {reporte.ventasPorDia.map((v) => (
              <tr key={v.dia}>
                <td>{v.dia}</td>
                <td>{v.comprobantes}</td>
                <td>{formatoCOP(v.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Total periodo</td>
              <td></td>
              <td className="font-semibold">{formatoCOP(reporte.totalPeriodo)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Platos más vendidos</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Plato</th>
              <th>Unidades</th>
              <th>Ventas</th>
            </tr>
          </thead>
          <tbody>
            {reporte.platosMasVendidos.map((p) => (
              <tr key={p.plato}>
                <td>{p.plato}</td>
                <td>{p.cantidad}</td>
                <td>{formatoCOP(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
