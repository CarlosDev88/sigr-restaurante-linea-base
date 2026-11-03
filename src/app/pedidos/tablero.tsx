"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ETIQUETA_ESTADO_PEDIDO, type EstadoPedido } from "@/lib/domain/constantes";
import type { PedidoResumen } from "@/lib/services/pedidos";
import { accionCambiarEstado } from "./actions";
import { BotonCobrar } from "./boton-cobrar";
import { ConexionEventos, type EstadoConexion } from "./conexion-eventos";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour12: false });

const TEXTO_ACCION: Partial<Record<EstadoPedido, string>> = {
  EN_PREPARACION: "Pasar a preparación",
  ENTREGADO: "Marcar entregado",
  CANCELADO: "Cancelar",
};

const TEXTO_CONEXION: Record<EstadoConexion, string> = {
  conectando: "Conectando…",
  conectado: "En vivo",
  reconectando: "Conexión perdida, reconectando…",
  "sin-permiso": "Sesión sin permiso para ver pedidos. Inicie sesión de nuevo.",
  cerrado: "Desconectado",
};

interface Instantanea {
  generadoEn: string;
  pedidos: PedidoResumen[];
}

interface Props {
  inicial: PedidoResumen[];
  generadoEn: string;
}

/**
 * Tablero de pedidos en tiempo real. Recibe instantáneas por Server-Sent Events
 * (`/api/pedidos/eventos`) cada vez que un pedido se crea, cambia de estado o se factura.
 * Solo aplica instantáneas más recientes que la que muestra (evita retrocesos por orden de llegada).
 */
export function TableroPedidos({ inicial, generadoEn }: Props) {
  const [pedidos, setPedidos] = useState(inicial);
  const [ultima, setUltima] = useState(generadoEn);
  const ultimaRef = useRef(generadoEn);
  const [conexion, setConexion] = useState<{ estado: EstadoConexion; conexiones: number }>({
    estado: "conectando",
    conexiones: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const aplicar = useCallback((i: Instantanea) => {
    if (i.generadoEn < ultimaRef.current) return;
    ultimaRef.current = i.generadoEn;
    setPedidos(i.pedidos);
    setUltima(i.generadoEn);
  }, []);

  useEffect(() => {
    const conexionEventos = new ConexionEventos<Instantanea>({
      url: "/api/pedidos/eventos",
      crearFuente: (url) => new EventSource(url),
      verificarAcceso: async () => (await fetch("/api/pedidos", { cache: "no-store" })).status,
      alRecibir: aplicar,
      alCambiarEstado: (estado, { conexiones }) => setConexion({ estado, conexiones }),
    });
    conexionEventos.iniciar();
    const enLinea = () => conexionEventos.reintentarAhora();
    window.addEventListener("online", enLinea);
    return () => {
      window.removeEventListener("online", enLinea);
      conexionEventos.cerrar();
    };
  }, [aplicar]);

  /** Consulta puntual (respaldo si el canal de eventos está caído al momento de una acción propia). */
  const recargar = useCallback(async () => {
    try {
      const r = await fetch("/api/pedidos", { cache: "no-store" });
      if (r.ok) aplicar((await r.json()) as Instantanea);
    } catch {
      // el canal de eventos o la reconexión traerán el estado actual
    }
  }, [aplicar]);

  const cambiar = (pedidoId: number, estado: EstadoPedido) =>
    iniciar(async () => {
      const r = await accionCambiarEstado(pedidoId, estado);
      setError(r.error ?? null);
      await recargar();
    });

  return (
    <div>
      <p
        className="mb-3 flex items-center gap-2 text-xs text-stone-500"
        aria-live="polite"
        data-testid="estado-conexion"
        data-estado={conexion.estado}
        data-conexiones={conexion.conexiones}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${conexion.estado === "conectado" ? "bg-green-600" : "bg-amber-500"}`}
        />
        {TEXTO_CONEXION[conexion.estado]} · última actualización: {hora(ultima)}
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
