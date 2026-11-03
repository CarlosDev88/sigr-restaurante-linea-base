import { EventEmitter } from "node:events";
import type { BD } from "../db/cliente";
import { listarPedidosActivos, type PedidoResumen } from "../services/pedidos";

export interface InstantaneaPedidos {
  generadoEn: string;
  /** Qué originó la instantánea (útil para depurar y para las pruebas). */
  motivo: { tipo: "inicial" | "creado" | "estado" | "facturado"; pedidoId?: number };
  pedidos: PedidoResumen[];
}

type Oyente = (i: InstantaneaPedidos) => void;

// Bus de eventos en memoria del proceso. Una sola instancia (globalThis) para que las
// Server Actions y el Route Handler de eventos compartan el mismo emisor.
// Limitación documentada: solo funciona con una instancia de la aplicación (igual que SQLite).
const globalBus = globalThis as unknown as { busPedidos?: EventEmitter };
const bus = globalBus.busPedidos ?? new EventEmitter();
bus.setMaxListeners(0);
globalBus.busPedidos = bus;

export function suscribirPedidos(oyente: Oyente): () => void {
  bus.on("cambio", oyente);
  return () => bus.off("cambio", oyente);
}

export function suscriptoresPedidos(): number {
  return bus.listenerCount("cambio");
}

export async function instantaneaPedidos(bd: BD, motivo: InstantaneaPedidos["motivo"]): Promise<InstantaneaPedidos> {
  return { generadoEn: new Date().toISOString(), motivo, pedidos: await listarPedidosActivos(bd) };
}

/**
 * Publica la lista actualizada de pedidos a todas las conexiones abiertas.
 * Se llama después de confirmar el cambio en la base de datos. Un fallo aquí no
 * revierte la operación: las pantallas se corrigen con la siguiente instantánea o al reconectar.
 */
export async function publicarCambioPedidos(bd: BD, motivo: InstantaneaPedidos["motivo"]) {
  if (suscriptoresPedidos() === 0) return;
  try {
    bus.emit("cambio", await instantaneaPedidos(bd, motivo));
  } catch (e) {
    console.error("No se pudo publicar el cambio de pedidos", e);
  }
}
