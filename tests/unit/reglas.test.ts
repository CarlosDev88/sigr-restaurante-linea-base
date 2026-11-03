import { describe, expect, it } from "vitest";
import {
  calcularTotal,
  diaBogota,
  fechaHoraBogota,
  finDeReserva,
  puedeTransicionar,
  seSolapan,
  validarHorarioReserva,
} from "@/lib/domain/reglas";

describe("pedidos", () => {
  it("calcula el total con precio unitario por cantidad", () => {
    expect(
      calcularTotal([
        { precioUnitario: 9000, cantidad: 2 },
        { precioUnitario: 32000, cantidad: 1 },
      ]),
    ).toBe(50000);
  });

  it("solo permite transiciones de estado válidas", () => {
    expect(puedeTransicionar("PENDIENTE", "EN_PREPARACION")).toBe(true);
    expect(puedeTransicionar("ENTREGADO", "PAGADO")).toBe(true);
    expect(puedeTransicionar("PENDIENTE", "PAGADO")).toBe(false);
    expect(puedeTransicionar("PAGADO", "CANCELADO")).toBe(false);
    expect(puedeTransicionar("ENTREGADO", "CANCELADO")).toBe(false);
  });
});

describe("reservas", () => {
  const h = (hora: string) => fechaHoraBogota("2030-05-10", hora);

  it("interpreta la hora en zona de Bogotá (UTC-5)", () => {
    expect(h("19:00").toISOString()).toBe("2030-05-11T00:00:00.000Z");
    expect(diaBogota(h("19:00"))).toBe("2030-05-10");
  });

  it("la reserva dura la duración configurada", () => {
    expect(finDeReserva(h("13:00")).getTime() - h("13:00").getTime()).toBe(120 * 60_000);
  });

  it("detecta solapamiento de intervalos [inicio, fin)", () => {
    const a = { inicio: h("13:00"), fin: h("15:00") };
    expect(seSolapan(a, { inicio: h("14:00"), fin: h("16:00") })).toBe(true);
    expect(seSolapan(a, { inicio: h("12:00"), fin: h("13:30") })).toBe(true);
    // termina justo cuando empieza la otra: no se solapan
    expect(seSolapan(a, { inicio: h("15:00"), fin: h("17:00") })).toBe(false);
  });

  it("rechaza horarios pasados o fuera de la franja", () => {
    const ahora = new Date("2030-05-10T12:00:00-05:00");
    expect(() => validarHorarioReserva(h("11:00"), ahora)).toThrow(/futura/);
    expect(() => validarHorarioReserva(h("21:30"), ahora)).toThrow(/entre/);
    expect(() => validarHorarioReserva(h("21:00"), ahora)).not.toThrow();
    expect(() => validarHorarioReserva(h("13:00"), ahora)).not.toThrow();
  });

  it("rechaza formatos inválidos", () => {
    expect(() => fechaHoraBogota("10/05/2030", "13:00")).toThrow();
  });
});
