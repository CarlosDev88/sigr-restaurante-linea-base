import Link from "next/link";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { ETIQUETA_MEDIO_PAGO } from "@/lib/domain/constantes";
import { formatoCOP, formatoFechaHora, numeroFactura } from "@/lib/domain/reglas";
import { listarFacturas } from "@/lib/services/facturacion";

export default async function Facturas() {
  await exigirRol(PERMISOS.verFacturas);
  const lista = await listarFacturas(db);
  return (
    <div>
      <h1 className="titulo">Facturas emitidas</h1>
      <table className="tabla card">
        <thead>
          <tr>
            <th>Número</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Mesa</th>
            <th>Medio de pago</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <td colSpan={6}>Aún no hay facturas.</td>
            </tr>
          )}
          {lista.map((f) => (
            <tr key={f.id}>
              <td>
                <Link href={`/facturas/${f.numero}`} className="underline">
                  {numeroFactura(f.prefijo, f.numero)}
                </Link>
              </td>
              <td>{formatoFechaHora(f.emitidaEn)}</td>
              <td>{f.clienteNombre}</td>
              <td>{f.mesaNumero}</td>
              <td>{ETIQUETA_MEDIO_PAGO[f.medioPago]}</td>
              <td>{formatoCOP(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
