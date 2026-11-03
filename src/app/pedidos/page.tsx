import Link from "next/link";
import { PERMISOS } from "@/lib/auth/permisos";
import { exigirRol } from "@/lib/auth/sesion";
import { db } from "@/lib/db";
import { listarPedidosActivos } from "@/lib/services/pedidos";
import { TableroPedidos } from "./tablero";

export default async function PaginaPedidos() {
  await exigirRol(PERMISOS.gestionarPedidos);
  const pedidos = await listarPedidosActivos(db);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="titulo mb-0">Pedidos en curso</h1>
        <Link href="/pedidos/nuevo" className="btn">
          Nuevo pedido
        </Link>
      </div>
      <TableroPedidos inicial={pedidos} generadoEn={new Date().toISOString()} />
    </div>
  );
}
