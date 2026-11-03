import Link from "next/link";

const modulos = [
  { href: "/menu", nombre: "Menú digital", detalle: "Consulta de platos disponibles por categoría." },
  { href: "/reservas", nombre: "Reservas", detalle: "Reserva por fecha, hora y número de personas." },
  { href: "/pedidos", nombre: "Pedidos", detalle: "Registro y seguimiento de pedidos por mesa." },
  { href: "/facturas", nombre: "Facturación", detalle: "Facturas de venta emitidas al cobrar los pedidos." },
  { href: "/caja", nombre: "Caja", detalle: "Cierres de caja y reportes de ventas." },
  { href: "/admin/menu", nombre: "Administrar menú", detalle: "CRUD de categorías y platos." },
];

export default function Inicio() {
  return (
    <div>
      <h1 className="titulo">Sistema Integral de Gestión de Restaurante</h1>
      <p className="mb-6 text-stone-600">
        Versión 1.1.0 (línea base: v1.0.0). Cada módulo exige iniciar sesión con el rol correspondiente.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {modulos.map((m) => (
          <Link key={m.href} href={m.href} className="card hover:border-orange-400">
            <h2 className="font-semibold">{m.nombre}</h2>
            <p className="text-sm text-stone-600">{m.detalle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
