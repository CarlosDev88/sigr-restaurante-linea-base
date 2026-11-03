import { db } from "@/lib/db";
import { formatoCOP } from "@/lib/domain/reglas";
import { listarMenu } from "@/lib/services/menu";

// Vista pública: siempre consulta la base de datos (refleja cambios de disponibilidad al instante).
export const dynamic = "force-dynamic";

export default async function MenuPublico() {
  const menu = await listarMenu(db, { soloDisponibles: true });
  return (
    <div>
      <h1 className="titulo">Menú</h1>
      {menu.length === 0 && <p className="text-stone-600">No hay platos disponibles.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {menu.map((c) => (
          <section key={c.id} className="card">
            <h2 className="mb-2 text-lg font-semibold">{c.nombre}</h2>
            <ul className="flex flex-col gap-2">
              {c.platos.map((p) => (
                <li key={p.id} className="flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{p.nombre}</div>
                    {p.descripcion && <div className="text-sm text-stone-600">{p.descripcion}</div>}
                  </div>
                  <div className="whitespace-nowrap font-medium">{formatoCOP(p.precio)}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
