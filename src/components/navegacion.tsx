import Link from "next/link";
import { salir } from "@/app/login/actions";
import { PERMISOS } from "@/lib/auth/permisos";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import type { Rol } from "@/lib/domain/constantes";

const ENLACES: { href: string; texto: string; roles?: readonly Rol[] }[] = [
  { href: "/menu", texto: "Menú" },
  { href: "/reservas", texto: "Mis reservas", roles: PERMISOS.crearReserva },
  { href: "/pedidos", texto: "Pedidos", roles: PERMISOS.gestionarPedidos },
  { href: "/admin/reservas", texto: "Reservas", roles: PERMISOS.administrarReservas },
  { href: "/admin/menu", texto: "Administrar menú", roles: PERMISOS.administrarMenu },
  { href: "/caja", texto: "Caja", roles: PERMISOS.caja },
];

// Solo decide qué enlaces mostrar; la autorización real ocurre en cada página y acción.
export async function Navegacion() {
  const usuario = await obtenerUsuarioActual();
  const visibles = ENLACES.filter((e) => !e.roles || (usuario && e.roles.includes(usuario.rol)));
  return (
    <nav className="flex flex-1 flex-wrap items-center gap-3 text-sm">
      {visibles.map((e) => (
        <Link key={e.href} href={e.href} className="hover:text-orange-800">
          {e.texto}
        </Link>
      ))}
      <span className="flex-1" />
      {usuario ? (
        <form action={salir} className="flex items-center gap-2">
          <span className="text-stone-600">
            {usuario.nombre} ({usuario.rol.toLowerCase()})
          </span>
          <button className="btn-sec">Salir</button>
        </form>
      ) : (
        <Link href="/login" className="btn">
          Iniciar sesión
        </Link>
      )}
    </nav>
  );
}
