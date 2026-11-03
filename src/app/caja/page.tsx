import Link from "next/link";
import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoCOP, formatoFechaHora } from "@/lib/domain/reglas";
import { cajaAbierta, listarCierres } from "@/lib/services/caja";
import { accionCerrarCaja } from "./actions";

export default async function Caja() {
  await exigirRol(PERMISOS.caja);
  const [abierta, cierres] = await Promise.all([cajaAbierta(db), listarCierres(db)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="titulo mb-0">Caja</h1>
        <Link href="/caja/reportes" className="btn-sec">
          Reportes de ventas
        </Link>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Caja abierta (comprobantes sin cierre)</h2>
        <table className="tabla mb-3">
          <thead>
            <tr>
              <th>N°</th>
              <th>Emitido</th>
              <th>Mesa</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {abierta.comprobantes.length === 0 && (
              <tr>
                <td colSpan={4}>No hay comprobantes pendientes.</td>
              </tr>
            )}
            {abierta.comprobantes.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/comprobantes/${c.numero}`} className="underline">
                    {c.numero}
                  </Link>
                </td>
                <td>{formatoFechaHora(c.emitidoEn)}</td>
                <td>{c.pedido.mesa.numero}</td>
                <td>{formatoCOP(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mb-3 font-semibold" data-testid="total-caja-abierta">
          Total pendiente: {formatoCOP(abierta.total)}
        </p>
        <FormularioAccion accion={accionCerrarCaja} textoBoton="Cerrar caja" className="flex flex-wrap items-center gap-3" />
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Historial de cierres</h2>
        <table className="tabla" data-testid="historial-cierres">
          <thead>
            <tr>
              <th>Cierre</th>
              <th>Fecha y hora</th>
              <th>Responsable</th>
              <th>Comprobantes</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {cierres.length === 0 && (
              <tr>
                <td colSpan={5}>Sin cierres registrados.</td>
              </tr>
            )}
            {cierres.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{formatoFechaHora(c.fechaHora)}</td>
                <td>{c.responsable.nombre}</td>
                <td>{c.cantidadComprobantes}</td>
                <td>{formatoCOP(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
