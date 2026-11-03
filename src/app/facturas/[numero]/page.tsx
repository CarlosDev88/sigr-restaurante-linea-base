import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ETIQUETA_MEDIO_PAGO, ETIQUETA_TIPO_DOCUMENTO } from "@/lib/domain/constantes";
import { formatoCOP, formatoFechaHora, numeroFactura } from "@/lib/domain/reglas";
import { obtenerFactura } from "@/lib/services/facturacion";

export default async function Factura({ params }: PageProps<"/facturas/[numero]">) {
  await exigirRol(PERMISOS.verFacturas);
  const { numero } = await params;
  const f = await obtenerFactura(db, Number(numero));
  if (!f) notFound();

  return (
    <div className="max-w-2xl">
      <article className="card" data-testid="factura">
        <header className="mb-4 flex flex-wrap justify-between gap-4 border-b border-stone-200 pb-3">
          <div className="text-sm">
            <div className="text-base font-bold">{f.emisorRazonSocial}</div>
            <div>NIT {f.emisorNit}</div>
            <div>{f.emisorDireccion}</div>
            <div>Tel. {f.emisorTelefono}</div>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold">Factura de venta</h1>
            <div className="text-lg font-semibold" data-testid="numero-factura">
              {numeroFactura(f.prefijo, f.numero)}
            </div>
            <div className="text-sm">{formatoFechaHora(f.emitidaEn)}</div>
          </div>
        </header>
        <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-900">
          Factura académica generada por SIGR. No es una factura electrónica de venta validada por la DIAN.
        </p>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="datos-cliente">
          <dt className="font-medium">Cliente</dt>
          <dd>{f.clienteNombre}</dd>
          {f.clienteTipoDocumento && (
            <>
              <dt className="font-medium">Documento</dt>
              <dd>
                {ETIQUETA_TIPO_DOCUMENTO[f.clienteTipoDocumento]} {f.clienteNumeroDocumento}
              </dd>
            </>
          )}
          {f.clienteEmail && (
            <>
              <dt className="font-medium">Correo</dt>
              <dd>{f.clienteEmail}</dd>
            </>
          )}
          <dt className="font-medium">Pedido / mesa</dt>
          <dd>
            #{f.pedido.id} / mesa {f.mesaNumero}
          </dd>
          <dt className="font-medium">Medio de pago</dt>
          <dd>{ETIQUETA_MEDIO_PAGO[f.medioPago]}</dd>
          <dt className="font-medium">Emitió</dt>
          <dd>{f.emitidaPor.nombre}</dd>
          <dt className="font-medium">Cierre de caja</dt>
          <dd>{f.cierre ? `N° ${f.cierre.id}` : "Pendiente"}</dd>
        </dl>
        <table className="tabla mb-3">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Descripción</th>
              <th>V. unitario</th>
              <th>V. total</th>
            </tr>
          </thead>
          <tbody>
            {f.items.map((i) => (
              <tr key={i.id}>
                <td>{i.cantidad}</td>
                <td>{i.descripcion}</td>
                <td>{formatoCOP(i.valorUnitario)}</td>
                <td>{formatoCOP(i.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto grid w-64 grid-cols-2 gap-1 text-sm">
          <dt>Subtotal (base)</dt>
          <dd className="text-right" data-testid="subtotal-factura">
            {formatoCOP(f.subtotal)}
          </dd>
          <dt>Impuesto al consumo ({f.tasaImpuestoConsumo} %)</dt>
          <dd className="text-right" data-testid="impuesto-factura">
            {formatoCOP(f.impuestoConsumo)}
          </dd>
          <dt className="text-base font-bold">Total</dt>
          <dd className="text-right text-base font-bold" data-testid="total-factura">
            {formatoCOP(f.total)}
          </dd>
        </dl>
      </article>
      <div className="mt-4 flex gap-2">
        <Link href="/pedidos" className="btn-sec">
          Volver a pedidos
        </Link>
        <Link href="/facturas" className="btn-sec">
          Ver facturas
        </Link>
      </div>
    </div>
  );
}
