import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { BD } from "../db/cliente";
import { facturaItems, facturas, pedidos } from "../db/schema";
import { MEDIOS_PAGO_SELECCIONABLES, PREFIJO_FACTURA, TASA_IMPUESTO_CONSUMO, TIPOS_DOCUMENTO } from "../domain/constantes";
import { datosEmisor } from "../domain/restaurante";
import { calcularFactura, diaBogota, ErrorNegocio, numeroFactura } from "../domain/reglas";

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const esquemaFacturar = z.discriminatedUnion("tipoCliente", [
  z.object({
    tipoCliente: z.literal("CONSUMIDOR_FINAL"),
    medioPago: z.enum(MEDIOS_PAGO_SELECCIONABLES, { error: "Seleccione el medio de pago." }),
  }),
  z.object({
    tipoCliente: z.literal("IDENTIFICADO"),
    medioPago: z.enum(MEDIOS_PAGO_SELECCIONABLES, { error: "Seleccione el medio de pago." }),
    clienteTipoDocumento: z.enum(TIPOS_DOCUMENTO, { error: "Seleccione el tipo de documento." }),
    clienteNumeroDocumento: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z.-]{5,20}$/, { error: "Número de documento inválido (5 a 20 caracteres)." }),
    clienteNombre: z.string().trim().min(3, { error: "Ingrese el nombre o razón social del cliente." }).max(120),
    clienteEmail: textoOpcional.pipe(z.email({ error: "Correo del cliente inválido." }).optional()),
  }),
]);

export type DatosFacturar = z.input<typeof esquemaFacturar>;

function esErrorUnico(e: unknown): boolean {
  const texto = String((e as { message?: string; cause?: { message?: string } })?.cause?.message ?? e);
  return /UNIQUE constraint failed/i.test(texto) || /UNIQUE constraint failed/i.test(String((e as Error)?.message));
}

/**
 * Factura un pedido ENTREGADO y lo marca como PAGADO (registro del cobro), en una sola transacción.
 * - El número es el consecutivo siguiente; la BD garantiza unicidad de número y de pedido.
 * - Los valores se calculan en el servidor a partir del detalle guardado del pedido.
 * - Se copian los datos del emisor, del cliente y del detalle (datos históricos).
 * - La jornada de caja es el día calendario de la emisión en hora de Bogotá.
 */
export async function facturarPedido(
  bd: BD,
  pedidoId: number,
  emitidaPorId: number,
  datos: DatosFacturar,
  ahora: Date = new Date(),
) {
  const entrada = esquemaFacturar.parse(datos);
  const emisor = datosEmisor();
  try {
    return await bd.transaction(
      async (tx) => {
        const pedido = await tx.query.pedidos.findFirst({
          where: eq(pedidos.id, pedidoId),
          with: { items: true, mesa: true, factura: { columns: { prefijo: true, numero: true } } },
        });
        if (!pedido) throw new ErrorNegocio("El pedido no existe.");
        if (pedido.factura) {
          throw new ErrorNegocio(
            `El pedido ya fue facturado (${numeroFactura(pedido.factura.prefijo, pedido.factura.numero)}).`,
          );
        }
        if (pedido.estado !== "ENTREGADO") throw new ErrorNegocio("Solo se facturan pedidos entregados.");

        const valores = calcularFactura(pedido.items, TASA_IMPUESTO_CONSUMO);
        const [{ ultimo }] = await tx
          .select({ ultimo: sql<number>`coalesce(max(${facturas.numero}), 0)` })
          .from(facturas);

        const cliente =
          entrada.tipoCliente === "IDENTIFICADO"
            ? {
                clienteNombre: entrada.clienteNombre,
                clienteTipoDocumento: entrada.clienteTipoDocumento,
                clienteNumeroDocumento: entrada.clienteNumeroDocumento,
                clienteEmail: entrada.clienteEmail ?? null,
              }
            : { clienteNombre: "Consumidor final" };

        const [factura] = await tx
          .insert(facturas)
          .values({
            prefijo: PREFIJO_FACTURA,
            numero: ultimo + 1,
            pedidoId,
            emitidaEn: ahora,
            jornada: diaBogota(ahora),
            emitidaPorId,
            emisorRazonSocial: emisor.razonSocial,
            emisorNit: emisor.nit,
            emisorDireccion: emisor.direccion,
            emisorTelefono: emisor.telefono,
            ...cliente,
            subtotal: valores.subtotal,
            tasaImpuestoConsumo: TASA_IMPUESTO_CONSUMO,
            impuestoConsumo: valores.impuestoConsumo,
            total: valores.total,
            medioPago: entrada.medioPago,
            mesaNumero: pedido.mesa.numero,
          })
          .returning();
        await tx.insert(facturaItems).values(valores.items.map((i) => ({ ...i, facturaId: factura.id })));

        // Registro del cobro: el pedido pasa a PAGADO solo si seguía ENTREGADO.
        const actualizados = await tx
          .update(pedidos)
          .set({ estado: "PAGADO", actualizadoEn: new Date() })
          .where(sql`${pedidos.id} = ${pedidoId} and ${pedidos.estado} = 'ENTREGADO'`)
          .returning({ id: pedidos.id });
        if (actualizados.length === 0) throw new ErrorNegocio("El pedido cambió mientras se facturaba.");
        return factura;
      },
      { behavior: "immediate" },
    );
  } catch (e) {
    if (esErrorUnico(e)) throw new ErrorNegocio("El pedido ya fue facturado.");
    throw e;
  }
}

export async function obtenerFactura(bd: BD, numero: number) {
  return bd.query.facturas.findFirst({
    where: eq(facturas.numero, numero),
    with: {
      items: true,
      emitidaPor: { columns: { nombre: true } },
      cierre: true,
      pedido: { columns: { id: true } },
    },
  });
}

export async function listarFacturas(bd: BD, limite = 50) {
  return bd.select().from(facturas).orderBy(desc(facturas.numero)).limit(limite);
}
