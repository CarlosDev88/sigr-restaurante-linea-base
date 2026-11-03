import Link from "next/link";

// En el commit de autenticación esta barra mostrará los enlaces según el rol.
export function Navegacion() {
  return (
    <nav className="flex flex-1 flex-wrap items-center gap-3 text-sm">
      <Link href="/menu">Menú</Link>
    </nav>
  );
}
