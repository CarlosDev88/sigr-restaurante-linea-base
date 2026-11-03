import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { pedidos } from "@/lib/db/schema";
import { ETIQUETA_ESTADO_PEDIDO, TASA_IMPUESTO_CONSUMO } from "@/lib/domain/constantes";
import { calcularFactura, formatoCOP, numeroFactura } from "@/lib/domain/reglas";
import { FormularioFacturar } from "./formulario-facturar";

export default async function FacturarPedido({ params }: PageProps<"/pedidos/[id]/facturar">) {
  await exigirRol(PERMISOS.facturar);
  const { id } = await params;
  const pedido = await db.query.pedidos.findFirst({
    where: eq(pedidos.id, Number(id)),
    with: { items: true, mesa: true, factura: { columns: { prefijo: true, numero: true } } },
  });
  if (!pedido) notFound();

  if (pedido.factura) {
    return (
      <div className="card max-w-lg">
        <p className="mb-3">Este pedido ya fue facturado.</p>
        <Link href={`/facturas/${pedido.factura.numero}`} className="btn">
          Ver factura {numeroFactura(pedido.factura.prefijo, pedido.factura.numero)}
        </Link>
      </div>
    );
  }

  // Vista previa calculada en el servidor (los mismos cálculos se repiten al emitir).
  const valores = calcularFactura(pedido.items, TASA_IMPUESTO_CONSUMO);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="titulo mb-0">
        Facturar pedido #{pedido.id} · Mesa {pedido.mesa.numero}
      </h1>
      {pedido.estado !== "ENTREGADO" && (
        <p role="alert" className="text-sm text-red-700">
          El pedido está {ETIQUETA_ESTADO_PEDIDO[pedido.estado].toLowerCase()}; solo se facturan pedidos entregados.
        </p>
      )}
      <table className="tabla card">
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Descripción</th>
            <th>V. unitario</th>
            <th>V. total</th>
          </tr>
        </thead>
        <tbody>
          {valores.items.map((i, n) => (
            <tr key={n}>
              <td>{i.cantidad}</td>
              <td>{i.descripcion}</td>
              <td>{formatoCOP(i.valorUnitario)}</td>
              <td>{formatoCOP(i.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="font-semibold">
              Total a pagar
            </td>
            <td className="font-semibold" data-testid="total-a-facturar">
              {formatoCOP(valores.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      {pedido.estado === "ENTREGADO" && <FormularioFacturar pedidoId={pedido.id} />}
    </div>
  );
}
