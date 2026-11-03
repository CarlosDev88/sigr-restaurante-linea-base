import { and, asc, desc, eq, gte, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import type { UsuarioSesion } from "../auth/permisos";
import type { BD } from "../db/cliente";
import { mesas, reservas } from "../db/schema";
import { DURACION_RESERVA_MIN } from "../domain/constantes";
import { ErrorNegocio, fechaHoraBogota, finDeReserva, validarHorarioReserva } from "../domain/reglas";

export const esquemaReserva = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Seleccione una fecha." }),
  hora: z.string().regex(/^\d{2}:\d{2}$/, { error: "Seleccione una hora." }),
  personas: z.coerce
    .number({ error: "Número de personas inválido." })
    .int()
    .min(1, { error: "Mínimo 1 persona." })
    .max(20, { error: "Para más de 20 personas comuníquese con el restaurante." }),
});

export type DatosReserva = z.input<typeof esquemaReserva>;

/**
 * Crea una reserva asignando automáticamente la mesa más pequeña que tenga capacidad
 * suficiente y que no tenga otra reserva activa que se cruce con [inicio, inicio + duración).
 * Varias reservas en la misma franja son válidas mientras haya mesas libres.
 */
export async function crearReserva(bd: BD, clienteId: number, datos: DatosReserva, ahora: Date = new Date()) {
  const { fecha, hora, personas } = esquemaReserva.parse(datos);
  const inicio = fechaHoraBogota(fecha, hora);
  validarHorarioReserva(inicio, ahora);
  const fin = finDeReserva(inicio);

  // Transacción inmediata: bloquea escritura mientras se verifica y se asigna la mesa.
  return bd.transaction(
    async (tx) => {
      const candidatas = await tx
        .select()
        .from(mesas)
        .where(gte(mesas.capacidad, personas))
        .orderBy(asc(mesas.capacidad), asc(mesas.numero));
      if (candidatas.length === 0) {
        throw new ErrorNegocio(`No hay mesas con capacidad para ${personas} personas.`);
      }
      for (const mesa of candidatas) {
        const cruce = await tx
          .select({ id: reservas.id })
          .from(reservas)
          .where(
            and(
              eq(reservas.mesaId, mesa.id),
              ne(reservas.estado, "CANCELADA"),
              lt(reservas.inicio, fin),
              gt(reservas.fin, inicio),
            ),
          )
          .limit(1);
        if (cruce.length === 0) {
          const [r] = await tx
            .insert(reservas)
            .values({ clienteId, mesaId: mesa.id, inicio, fin, personas })
            .returning();
          return { ...r, mesaNumero: mesa.numero };
        }
      }
      throw new ErrorNegocio(
        `No hay mesas disponibles para ${personas} personas en ese horario (duración ${DURACION_RESERVA_MIN} min). Pruebe otra hora.`,
      );
    },
    { behavior: "immediate" },
  );
}

export async function listarReservasCliente(bd: BD, clienteId: number) {
  return bd.query.reservas.findMany({
    where: eq(reservas.clienteId, clienteId),
    orderBy: desc(reservas.inicio),
    with: { mesa: true },
  });
}

export async function listarReservasDesde(bd: BD, desde: Date) {
  return bd.query.reservas.findMany({
    where: gte(reservas.fin, desde),
    orderBy: asc(reservas.inicio),
    with: { mesa: true, cliente: { columns: { nombre: true, email: true } } },
  });
}

/** El cliente solo cancela sus propias reservas futuras; el administrador, cualquiera. */
export async function cancelarReserva(bd: BD, reservaId: number, usuario: UsuarioSesion, ahora: Date = new Date()) {
  const [r] = await bd.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!r) throw new ErrorNegocio("La reserva no existe.");
  if (usuario.rol !== "ADMIN") {
    if (r.clienteId !== usuario.id) throw new ErrorNegocio("La reserva no le pertenece.");
    if (r.inicio <= ahora) throw new ErrorNegocio("No se puede cancelar una reserva que ya inició.");
  }
  if (r.estado === "CANCELADA") throw new ErrorNegocio("La reserva ya está cancelada.");
  await bd.update(reservas).set({ estado: "CANCELADA" }).where(eq(reservas.id, reservaId));
}

export async function confirmarReserva(bd: BD, reservaId: number) {
  const [r] = await bd.select().from(reservas).where(eq(reservas.id, reservaId));
  if (!r) throw new ErrorNegocio("La reserva no existe.");
  if (r.estado !== "PENDIENTE") throw new ErrorNegocio("Solo se confirman reservas pendientes.");
  await bd.update(reservas).set({ estado: "CONFIRMADA" }).where(eq(reservas.id, reservaId));
}
