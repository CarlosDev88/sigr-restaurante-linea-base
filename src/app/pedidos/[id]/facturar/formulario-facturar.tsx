"use client";

import { useActionState, useState } from "react";
import { accionFacturarPedido } from "@/app/facturas/actions";
import {
  ETIQUETA_MEDIO_PAGO,
  ETIQUETA_TIPO_DOCUMENTO,
  MEDIOS_PAGO_SELECCIONABLES,
  TIPOS_DOCUMENTO,
} from "@/lib/domain/constantes";

export function FormularioFacturar({ pedidoId }: { pedidoId: number }) {
  const [estado, ejecutar, pendiente] = useActionState(accionFacturarPedido, {});
  const [identificado, setIdentificado] = useState(false);

  return (
    <form action={ejecutar} className="card flex flex-col gap-3">
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <label className="flex flex-col gap-1 text-sm">
        Medio de pago
        <select name="medioPago" className="input" required defaultValue="EFECTIVO">
          {MEDIOS_PAGO_SELECCIONABLES.map((m) => (
            <option key={m} value={m}>
              {ETIQUETA_MEDIO_PAGO[m]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1">Cliente</legend>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="tipoCliente"
            value="CONSUMIDOR_FINAL"
            checked={!identificado}
            onChange={() => setIdentificado(false)}
          />
          Consumidor final
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="tipoCliente"
            value="IDENTIFICADO"
            checked={identificado}
            onChange={() => setIdentificado(true)}
          />
          Con datos del cliente
        </label>
      </fieldset>

      {identificado && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Tipo de documento
            <select name="clienteTipoDocumento" className="input" defaultValue="CC">
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_DOCUMENTO[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Número de documento
            <input name="clienteNumeroDocumento" className="input" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nombre o razón social
            <input name="clienteNombre" className="input" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Correo (opcional)
            <input name="clienteEmail" type="email" className="input" />
          </label>
        </div>
      )}

      <button type="submit" className="btn self-start" disabled={pendiente}>
        {pendiente ? "Procesando…" : "Emitir factura"}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm text-red-700">
          {estado.error}
        </p>
      )}
    </form>
  );
}
