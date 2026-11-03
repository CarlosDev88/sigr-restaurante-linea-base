import Link from "next/link";

/** Lleva al formulario de facturación (cobro) del pedido. */
export function BotonCobrar({ pedidoId }: { pedidoId: number }) {
  return (
    <Link href={`/pedidos/${pedidoId}/facturar`} className="btn">
      Cobrar y facturar
    </Link>
  );
}
