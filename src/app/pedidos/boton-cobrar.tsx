"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { accionPagarPedido } from "@/app/caja/actions";

export function BotonCobrar({ pedidoId }: { pedidoId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      <button
        className="btn"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await accionPagarPedido(pedidoId);
            if (r.error) setError(r.error);
            else if (r.numero) router.push(`/comprobantes/${r.numero}`);
          })
        }
      >
        Cobrar y emitir comprobante
      </button>
      {error && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
