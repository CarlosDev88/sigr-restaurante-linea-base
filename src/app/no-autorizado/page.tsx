import Link from "next/link";

export default function NoAutorizado() {
  return (
    <div className="card max-w-md">
      <h1 className="titulo">Acceso no autorizado</h1>
      <p className="mb-4 text-sm text-stone-600">Su rol no tiene permiso para esta sección.</p>
      <Link href="/" className="btn-sec">
        Volver al inicio
      </Link>
    </div>
  );
}
