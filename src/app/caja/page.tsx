import Link from "next/link";
import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { diaBogota, formatoCOP, formatoFechaHora, numeroFactura } from "@/lib/domain/reglas";
import { cajaAbierta, listarCierres } from "@/lib/services/caja";
import { accionCerrarCaja } from "./actions";

export default async function Caja({ searchParams }: PageProps<"/caja">) {
  await exigirRol(PERMISOS.caja);
  const [abierta, cierres] = await Promise.all([cajaAbierta(db), listarCierres(db)]);
  const { cierre: cierreParam } = await searchParams;
  const recien = cierres.find((c) => c.id === Number(cierreParam));
  const hoy = diaBogota(new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo mb-0">Caja</h1>
        <Link href="/caja/reportes" className="btn-sec">
          Reportes de ventas
        </Link>
      </div>
      {recien && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Cierre registrado: jornada {recien.jornada}, turno {recien.turno}: {recien.cantidadFacturas} facturas por{" "}
          {formatoCOP(recien.total)}.
        </p>
      )}
      <p className="text-sm text-stone-600">
        Jornada actual: <strong>{hoy}</strong> (día calendario en hora de Bogotá). Cada cierre agrupa solo las facturas
        pendientes de su jornada; si hay ventas después de un cierre, se cierran en el turno siguiente.
      </p>

      <section className="card" data-testid="caja-abierta">
        <h2 className="mb-2 font-semibold">Facturas pendientes de cierre</h2>
        {abierta.jornadas.length === 0 && <p className="text-sm text-stone-600">No hay facturas pendientes.</p>}
        {abierta.jornadas.map((j) => (
          <div key={j.jornada} className="mb-4" data-jornada={j.jornada}>
            <h3 className="mb-1 font-medium">
              Jornada {j.jornada}
              {j.jornada < hoy && <span className="ml-2 text-xs text-red-700">(jornada anterior sin cerrar)</span>}
            </h3>
            <table className="tabla mb-2">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Emitida</th>
                  <th>Mesa</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {j.facturas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/facturas/${f.numero}`} className="underline">
                        {numeroFactura(f.prefijo, f.numero)}
                      </Link>
                    </td>
                    <td>{formatoFechaHora(f.emitidaEn)}</td>
                    <td>{f.mesaNumero}</td>
                    <td>{formatoCOP(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <FormularioAccion
              accion={accionCerrarCaja}
              textoBoton={`Cerrar turno ${j.siguienteTurno} de la jornada ${j.jornada}`}
              className="flex flex-wrap items-center gap-3"
            >
              <span className="font-semibold" data-testid="total-pendiente">
                Total pendiente: {formatoCOP(j.total)}
              </span>
              <input type="hidden" name="jornada" value={j.jornada} />
            </FormularioAccion>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Historial de cierres</h2>
        <table className="tabla" data-testid="historial-cierres">
          <thead>
            <tr>
              <th>Jornada</th>
              <th>Turno</th>
              <th>Cerrado el</th>
              <th>Responsable</th>
              <th>Facturas</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {cierres.length === 0 && (
              <tr>
                <td colSpan={6}>Sin cierres registrados.</td>
              </tr>
            )}
            {cierres.map((c) => (
              <tr key={c.id}>
                <td>{c.jornada}</td>
                <td>{c.turno}</td>
                <td>{formatoFechaHora(c.fechaHora)}</td>
                <td>{c.responsable.nombre}</td>
                <td>{c.cantidadFacturas}</td>
                <td>{formatoCOP(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
