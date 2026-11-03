"use client";

import { useActionState, type ReactNode } from "react";
import type { EstadoAccion } from "@/lib/acciones";

interface Props {
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  textoBoton: string;
  children?: ReactNode;
  className?: string;
  claseBoton?: string;
}

/** Formulario que ejecuta una Server Action y muestra su resultado. */
export function FormularioAccion({ accion, textoBoton, children, className, claseBoton = "btn" }: Props) {
  const [estado, ejecutar, pendiente] = useActionState(accion, {});
  return (
    <form action={ejecutar} className={className}>
      {children}
      <button type="submit" className={claseBoton} disabled={pendiente}>
        {pendiente ? "Procesando…" : textoBoton}
      </button>
      {estado.error && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p role="status" className="basis-full text-sm text-green-700">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
