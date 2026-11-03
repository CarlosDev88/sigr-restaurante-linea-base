import { FormularioAccion } from "@/components/formulario-accion";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoCOP } from "@/lib/domain/reglas";
import { listarMenu } from "@/lib/services/menu";
import {
  accionActualizarPlato,
  accionCrearCategoria,
  accionCrearPlato,
  accionEliminarCategoria,
  accionEliminarPlato,
} from "./actions";

export default async function AdministrarMenu() {
  await exigirRol(PERMISOS.administrarMenu);
  const menu = await listarMenu(db, { soloDisponibles: false });

  const selectorCategoria = (seleccionada?: number) => (
    <select name="categoriaId" defaultValue={seleccionada} className="input" required>
      {menu.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titulo">Administrar menú</h1>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Nueva categoría</h2>
          <FormularioAccion accion={accionCrearCategoria} textoBoton="Crear categoría" className="flex flex-wrap gap-2">
            <input name="nombre" placeholder="Nombre" className="input flex-1" required aria-label="Nombre de la categoría" />
          </FormularioAccion>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">Nuevo plato</h2>
          {menu.length === 0 ? (
            <p className="text-sm text-stone-600">Cree primero una categoría.</p>
          ) : (
            <FormularioAccion accion={accionCrearPlato} textoBoton="Crear plato" className="flex flex-wrap gap-2">
              <input name="nombre" placeholder="Nombre" className="input flex-1" required aria-label="Nombre del plato" />
              <input name="precio" type="number" min={1} step={1} placeholder="Precio" className="input w-28" required aria-label="Precio" />
              <input name="descripcion" placeholder="Descripción (opcional)" className="input w-full" aria-label="Descripción" />
              {selectorCategoria()}
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="disponible" defaultChecked /> Disponible
              </label>
            </FormularioAccion>
          )}
        </div>
      </section>

      {menu.map((c) => (
        <section key={c.id} className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{c.nombre}</h2>
            <FormularioAccion accion={accionEliminarCategoria} textoBoton="Eliminar categoría" claseBoton="btn-sec" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
            </FormularioAccion>
          </div>
          {c.platos.length === 0 && <p className="text-sm text-stone-500">Sin platos.</p>}
          <ul className="flex flex-col gap-3">
            {c.platos.map((p) => (
              <li key={p.id} className="rounded-md border border-stone-100 p-2" data-plato={p.nombre}>
                <div className="mb-1 text-xs text-stone-500">
                  Actual: {formatoCOP(p.precio)} · {p.disponible ? "disponible" : "no disponible"}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <FormularioAccion accion={accionActualizarPlato} textoBoton="Guardar" className="flex flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="nombre" defaultValue={p.nombre} className="input flex-1" required aria-label="Nombre" />
                    <input name="precio" type="number" min={1} step={1} defaultValue={p.precio} className="input w-28" required aria-label="Precio" />
                    <input name="descripcion" defaultValue={p.descripcion} className="input w-full" aria-label="Descripción" />
                    {selectorCategoria(p.categoriaId)}
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="disponible" defaultChecked={p.disponible} /> Disponible
                    </label>
                  </FormularioAccion>
                  <FormularioAccion accion={accionEliminarPlato} textoBoton="Eliminar" claseBoton="btn-sec" className="flex flex-col gap-1">
                    <input type="hidden" name="id" value={p.id} />
                  </FormularioAccion>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
