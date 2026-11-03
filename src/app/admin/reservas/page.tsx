import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ETIQUETA_ESTADO_RESERVA, OFFSET_BOGOTA } from "@/lib/domain/constantes";
import { diaBogota, formatoFechaHora } from "@/lib/domain/reglas";
import { listarReservasDesde } from "@/lib/services/reservas";
import { accionCancelarReserva, accionConfirmarReserva } from "@/app/reservas/actions";

export default async function AdministrarReservas() {
  await exigirRol(PERMISOS.administrarReservas);
  const inicioDeHoy = new Date(`${diaBogota(new Date())}T00:00:00${OFFSET_BOGOTA}`);
  const lista = await listarReservasDesde(db, inicioDeHoy);

  return (
    <div>
      <h1 className="titulo">Reservas desde hoy</h1>
      <table className="tabla card">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Cliente</th>
            <th>Personas</th>
            <th>Mesa</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <td colSpan={6}>No hay reservas.</td>
            </tr>
          )}
          {lista.map((r) => (
            <tr key={r.id}>
              <td>{formatoFechaHora(r.inicio)}</td>
              <td>{r.cliente.nombre}</td>
              <td>{r.personas}</td>
              <td>
                {r.mesa.numero} (cap. {r.mesa.capacidad})
              </td>
              <td>{ETIQUETA_ESTADO_RESERVA[r.estado]}</td>
              <td className="flex flex-wrap gap-2">
                {r.estado === "PENDIENTE" && (
                  <FormularioAccion accion={accionConfirmarReserva} textoBoton="Confirmar">
                    <input type="hidden" name="id" value={r.id} />
                  </FormularioAccion>
                )}
                {r.estado !== "CANCELADA" && (
                  <FormularioAccion accion={accionCancelarReserva} textoBoton="Cancelar" claseBoton="btn-sec">
                    <input type="hidden" name="id" value={r.id} />
                  </FormularioAccion>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
