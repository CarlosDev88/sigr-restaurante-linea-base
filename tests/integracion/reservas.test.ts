import { beforeEach, describe, expect, it } from "vitest";
import type { UsuarioSesion } from "@/lib/auth/permisos";
import { mesas } from "@/lib/db/schema";
import { cancelarReserva, confirmarReserva, crearReserva } from "@/lib/services/reservas";
import { crearUsuario, db, limpiarBD } from "../helpers/db";

const AHORA = new Date("2030-05-10T08:00:00-05:00");
const FECHA = "2030-05-10";

describe("reservas", () => {
  let cliente: UsuarioSesion;
  let otroCliente: UsuarioSesion;
  const reservar = (hora: string, personas: number, quien = cliente) =>
    crearReserva(db, quien.id, { fecha: FECHA, hora, personas }, AHORA);

  beforeEach(async () => {
    await limpiarBD();
    cliente = await crearUsuario("CLIENTE");
    otroCliente = await crearUsuario("CLIENTE", "otro@test.local");
    await db.insert(mesas).values([
      { numero: 1, capacidad: 2 },
      { numero: 2, capacidad: 4 },
      { numero: 3, capacidad: 4 },
    ]);
  });

  it("asigna la mesa más pequeña con capacidad suficiente", async () => {
    expect((await reservar("13:00", 2)).mesaNumero).toBe(1);
    expect((await reservar("13:00", 3)).mesaNumero).toBe(2);
  });

  it("acepta varias reservas en la misma franja mientras haya mesas libres", async () => {
    expect((await reservar("19:00", 4)).mesaNumero).toBe(2);
    expect((await reservar("19:00", 4)).mesaNumero).toBe(3);
    await expect(reservar("20:00", 4)).rejects.toThrow(/No hay mesas disponibles/);
    // un grupo de 2 todavía cabe en la mesa 1
    expect((await reservar("20:00", 2)).mesaNumero).toBe(1);
  });

  it("respeta la duración: la mesa queda libre al terminar la reserva anterior", async () => {
    await reservar("13:00", 2); // 13:00–15:00 en mesa 1
    expect((await reservar("14:30", 2)).mesaNumero).toBe(2); // se cruza con la mesa 1
    expect((await reservar("15:00", 2)).mesaNumero).toBe(1); // empieza justo al terminar
  });

  it("rechaza grupos mayores a la mesa más grande", async () => {
    await expect(reservar("13:00", 5)).rejects.toThrow(/capacidad/);
  });

  it("una reserva cancelada libera la mesa", async () => {
    const r = await reservar("13:00", 4);
    await reservar("13:00", 4);
    await expect(reservar("13:00", 4)).rejects.toThrow();
    await cancelarReserva(db, r.id, cliente, AHORA);
    expect((await reservar("13:00", 4)).mesaNumero).toBe(r.mesaNumero);
  });

  it("un cliente no cancela reservas ajenas; el administrador sí", async () => {
    const r = await reservar("13:00", 2);
    await expect(cancelarReserva(db, r.id, otroCliente, AHORA)).rejects.toThrow(/no le pertenece/);
    const admin = await crearUsuario("ADMIN");
    await confirmarReserva(db, r.id);
    await cancelarReserva(db, r.id, admin, AHORA);
  });

  it("rechaza horarios en el pasado o fuera de la franja", async () => {
    await expect(crearReserva(db, cliente.id, { fecha: "2030-05-09", hora: "13:00", personas: 2 }, AHORA)).rejects.toThrow(
      /futura/,
    );
    await expect(reservar("22:00", 2)).rejects.toThrow(/entre/);
  });
});
