import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import {
  DURACION_RESERVA_MIN,
  ETIQUETA_ESTADO_RESERVA,
  HORA_APERTURA_RESERVAS,
  HORA_ULTIMA_RESERVA,
} from "@/lib/domain/constantes";
import { diaBogota, formatoFechaHora } from "@/lib/domain/reglas";
import { listarReservasCliente } from "@/lib/services/reservas";
import { accionCancelarReserva, accionCrearReserva } from "./actions";

const HORAS: string[] = [];
for (let h = HORA_APERTURA_RESERVAS; h <= HORA_ULTIMA_RESERVA; h++) {
  HORAS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < HORA_ULTIMA_RESERVA) HORAS.push(`${String(h).padStart(2, "0")}:30`);
}

export default async function MisReservas() {
  const usuario = await exigirRol(PERMISOS.crearReserva);
  const lista = await listarReservasCliente(db, usuario.id);
  const ahora = new Date();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titulo mb-0">Mis reservas</h1>
      <div className="card">
        <h2 className="mb-1 font-semibold">Nueva reserva</h2>
        <p className="mb-3 text-xs text-stone-500">
          Cada reserva ocupa la mesa {DURACION_RESERVA_MIN} minutos. La mesa se asigna según el número de personas.
        </p>
        <FormularioAccion accion={accionCrearReserva} textoBoton="Reservar" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Fecha
            <input type="date" name="fecha" min={diaBogota(ahora)} required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hora
            <select name="hora" required className="input">
              {HORAS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Personas
            <input type="number" name="personas" min={1} max={20} defaultValue={2} required className="input w-20" />
          </label>
        </FormularioAccion>
      </div>

      <table className="tabla card">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Personas</th>
            <th>Mesa</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <td colSpan={5}>Aún no tiene reservas.</td>
            </tr>
          )}
          {lista.map((r) => (
            <tr key={r.id} data-reserva={r.id}>
              <td>{formatoFechaHora(r.inicio)}</td>
              <td>{r.personas}</td>
              <td>{r.mesa.numero}</td>
              <td>{ETIQUETA_ESTADO_RESERVA[r.estado]}</td>
              <td>
                {r.estado !== "CANCELADA" && r.inicio > ahora && (
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
