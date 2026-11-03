import { asc } from "drizzle-orm";
import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { mesas } from "@/lib/db/schema";
import { formatoCOP } from "@/lib/domain/reglas";
import { listarMenu } from "@/lib/services/menu";
import { accionCrearPedido } from "../actions";

export default async function NuevoPedido() {
  await exigirRol(PERMISOS.gestionarPedidos);
  const [listaMesas, menu] = await Promise.all([
    db.select().from(mesas).orderBy(asc(mesas.numero)),
    listarMenu(db, { soloDisponibles: true }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="titulo">Nuevo pedido</h1>
      <FormularioAccion accion={accionCrearPedido} textoBoton="Registrar pedido" className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Mesa
          <select name="mesaId" className="input" required>
            {listaMesas.map((m) => (
              <option key={m.id} value={m.id}>
                Mesa {m.numero} ({m.capacidad} personas)
              </option>
            ))}
          </select>
        </label>
        {menu.map((c) => (
          <fieldset key={c.id}>
            <legend className="mb-1 font-semibold">{c.nombre}</legend>
            {c.platos.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span>
                  {p.nombre} · {formatoCOP(p.precio)}
                </span>
                <input
                  name={`cant_${p.id}`}
                  type="number"
                  min={0}
                  max={50}
                  defaultValue={0}
                  className="input w-20"
                  aria-label={`Cantidad de ${p.nombre}`}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </FormularioAccion>
    </div>
  );
}
