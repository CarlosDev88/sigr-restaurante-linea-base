"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ETIQUETA_ESTADO_PEDIDO, INTERVALO_ACTUALIZACION_MS, type EstadoPedido } from "@/lib/domain/constantes";
import type { PedidoResumen } from "@/lib/services/pedidos";
import { accionCambiarEstado } from "./actions";
import { BotonCobrar } from "./boton-cobrar";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour12: false });

const TEXTO_ACCION: Partial<Record<EstadoPedido, string>> = {
  EN_PREPARACION: "Pasar a preparación",
  ENTREGADO: "Marcar entregado",
  CANCELADO: "Cancelar",
};

interface Props {
  inicial: PedidoResumen[];
  generadoEn: string;
}

/**
 * Tablero con actualización automática por consulta periódica (polling) cada
 * INTERVALO_ACTUALIZACION_MS. Un cambio hecho en otra pantalla puede tardar hasta ese
 * intervalo, más la latencia de red, en aparecer aquí.
 */
export function TableroPedidos({ inicial, generadoEn }: Props) {
  const [pedidos, setPedidos] = useState(inicial);
  const [ultima, setUltima] = useState(generadoEn);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const recargar = useCallback(async () => {
    try {
      const r = await fetch("/api/pedidos", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const datos = (await r.json()) as { generadoEn: string; pedidos: PedidoResumen[] };
      setPedidos(datos.pedidos);
      setUltima(datos.generadoEn);
      setError(null);
    } catch {
      setError("No se pudo actualizar el tablero; se reintentará automáticamente.");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(recargar, INTERVALO_ACTUALIZACION_MS);
    return () => clearInterval(id);
  }, [recargar]);

  const cambiar = (pedidoId: number, estado: EstadoPedido) =>
    iniciar(async () => {
      const r = await accionCambiarEstado(pedidoId, estado);
      if (r.error) setError(r.error);
      await recargar();
    });

  return (
    <div>
      <p className="mb-3 text-xs text-stone-500" aria-live="polite">
        Actualización automática cada {INTERVALO_ACTUALIZACION_MS / 1000} s · última: {hora(ultima)}
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {pedidos.length === 0 && <p className="text-stone-600">No hay pedidos en curso.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {pedidos.map((p) => (
          <article key={p.id} className="card" data-pedido={p.id}>
            <header className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                Pedido #{p.id} · Mesa {p.mesa}
              </h2>
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900" data-estado={p.estado}>
                {ETIQUETA_ESTADO_PEDIDO[p.estado]}
              </span>
            </header>
            <ul className="mb-2 text-sm">
              {p.items.map((i, n) => (
                <li key={n}>
                  {i.cantidad} × {i.nombre} — {pesos.format(i.precioUnitario * i.cantidad)}
                </li>
              ))}
            </ul>
            <p className="mb-2 text-sm">
              <strong>Total: {pesos.format(p.total)}</strong> · {p.mesero} · {hora(p.creadoEn)}
            </p>
            <div className="flex flex-wrap gap-2">
              {p.siguientes
                .filter((s) => s !== "PAGADO")
                .map((s) => (
                  <button
                    key={s}
                    className={s === "CANCELADO" ? "btn-sec" : "btn"}
                    disabled={pendiente}
                    onClick={() => cambiar(p.id, s)}
                  >
                    {TEXTO_ACCION[s]}
                  </button>
                ))}
              {p.siguientes.includes("PAGADO") && <BotonCobrar pedidoId={p.id} />}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
