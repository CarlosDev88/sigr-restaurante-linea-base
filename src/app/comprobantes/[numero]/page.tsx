import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { formatoCOP, formatoFechaHora } from "@/lib/domain/reglas";
import { obtenerComprobante } from "@/lib/services/caja";

export default async function Comprobante({ params }: PageProps<"/comprobantes/[numero]">) {
  await exigirRol(PERMISOS.verComprobantes);
  const { numero } = await params;
  const c = await obtenerComprobante(db, Number(numero));
  if (!c) notFound();

  return (
    <div className="max-w-lg">
      <article className="card" data-testid="comprobante">
        <h1 className="text-xl font-bold">Comprobante interno de venta N° {String(c.numero).padStart(6, "0")}</h1>
        <p className="mb-3 text-xs text-stone-500">
          Documento de control interno. No es una factura electrónica de venta.
        </p>
        <dl className="mb-3 grid grid-cols-2 gap-1 text-sm">
          <dt>Emitido</dt>
          <dd>{formatoFechaHora(c.emitidoEn)}</dd>
          <dt>Pedido / mesa</dt>
          <dd>
            #{c.pedido.id} / mesa {c.pedido.mesa.numero}
          </dd>
          <dt>Atendió</dt>
          <dd>{c.pedido.mesero.nombre}</dd>
          <dt>Emitió</dt>
          <dd>{c.emitidoPor.nombre}</dd>
          <dt>Cierre de caja</dt>
          <dd>{c.cierre ? `N° ${c.cierre.id}` : "Pendiente"}</dd>
        </dl>
        <table className="tabla mb-3">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Detalle</th>
              <th>V. unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {c.pedido.items.map((i) => (
              <tr key={i.id}>
                <td>{i.cantidad}</td>
                <td>{i.nombrePlato}</td>
                <td>{formatoCOP(i.precioUnitario)}</td>
                <td>{formatoCOP(i.precioUnitario * i.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right text-lg font-bold" data-testid="total-comprobante">
          Total: {formatoCOP(c.total)}
        </p>
      </article>
      <Link href="/pedidos" className="btn-sec mt-4">
        Volver a pedidos
      </Link>
    </div>
  );
}
