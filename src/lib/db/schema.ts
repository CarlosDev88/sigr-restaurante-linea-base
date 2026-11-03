// Esquema de datos del Sistema Integral de Gestión de Restaurante (SIGR).
// Motor: SQLite (archivo local vía libsql). Montos en pesos colombianos enteros (COP).
// Roles y estados se guardan como texto y se validan en src/lib/domain/constantes.ts.
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { EstadoPedido, EstadoReserva, Rol } from "../domain/constantes";

const ahora = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

export const usuarios = sqliteTable("usuarios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: text("rol").$type<Rol>().notNull(),
  creadoEn: integer("creado_en", { mode: "timestamp_ms" }).notNull().default(ahora),
});

export const categorias = sqliteTable("categorias", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull().unique(),
});

export const platos = sqliteTable("platos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull().default(""),
  precio: integer("precio").notNull(),
  disponible: integer("disponible", { mode: "boolean" }).notNull().default(true),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categorias.id, { onDelete: "restrict" }),
});

export const mesas = sqliteTable("mesas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  numero: integer("numero").notNull().unique(),
  capacidad: integer("capacidad").notNull(),
});

export const reservas = sqliteTable(
  "reservas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clienteId: integer("cliente_id")
      .notNull()
      .references(() => usuarios.id),
    mesaId: integer("mesa_id")
      .notNull()
      .references(() => mesas.id),
    inicio: integer("inicio", { mode: "timestamp_ms" }).notNull(),
    fin: integer("fin", { mode: "timestamp_ms" }).notNull(),
    personas: integer("personas").notNull(),
    estado: text("estado").$type<EstadoReserva>().notNull().default("PENDIENTE"),
    creadoEn: integer("creado_en", { mode: "timestamp_ms" }).notNull().default(ahora),
  },
  (t) => [index("reservas_mesa_inicio_idx").on(t.mesaId, t.inicio)],
);

export const pedidos = sqliteTable("pedidos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mesaId: integer("mesa_id")
    .notNull()
    .references(() => mesas.id),
  meseroId: integer("mesero_id")
    .notNull()
    .references(() => usuarios.id),
  estado: text("estado").$type<EstadoPedido>().notNull().default("PENDIENTE"),
  creadoEn: integer("creado_en", { mode: "timestamp_ms" }).notNull().default(ahora),
  actualizadoEn: integer("actualizado_en", { mode: "timestamp_ms" }).notNull().default(ahora),
});

export const pedidoItems = sqliteTable("pedido_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedidoId: integer("pedido_id")
    .notNull()
    .references(() => pedidos.id, { onDelete: "cascade" }),
  platoId: integer("plato_id")
    .notNull()
    .references(() => platos.id),
  nombrePlato: text("nombre_plato").notNull(), // copia al momento del pedido
  precioUnitario: integer("precio_unitario").notNull(), // copia al momento del pedido
  cantidad: integer("cantidad").notNull(),
});

/** Cierre de caja persistido: una vez creado, su total no cambia. */
export const cierresCaja = sqliteTable("cierres_caja", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fechaHora: integer("fecha_hora", { mode: "timestamp_ms" }).notNull().default(ahora),
  responsableId: integer("responsable_id")
    .notNull()
    .references(() => usuarios.id),
  total: integer("total").notNull(),
  cantidadComprobantes: integer("cantidad_comprobantes").notNull(),
});

/** Comprobante interno de venta. NO es factura electrónica DIAN. */
export const comprobantes = sqliteTable("comprobantes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  numero: integer("numero").notNull().unique(), // consecutivo
  pedidoId: integer("pedido_id")
    .notNull()
    .unique()
    .references(() => pedidos.id),
  total: integer("total").notNull(),
  emitidoEn: integer("emitido_en", { mode: "timestamp_ms" }).notNull().default(ahora),
  emitidoPorId: integer("emitido_por_id")
    .notNull()
    .references(() => usuarios.id),
  cierreId: integer("cierre_id").references(() => cierresCaja.id),
});

// ---------- Relaciones (para consultas con `db.query`) ----------

export const categoriasRelaciones = relations(categorias, ({ many }) => ({ platos: many(platos) }));

export const platosRelaciones = relations(platos, ({ one }) => ({
  categoria: one(categorias, { fields: [platos.categoriaId], references: [categorias.id] }),
}));

export const reservasRelaciones = relations(reservas, ({ one }) => ({
  cliente: one(usuarios, { fields: [reservas.clienteId], references: [usuarios.id] }),
  mesa: one(mesas, { fields: [reservas.mesaId], references: [mesas.id] }),
}));

export const pedidosRelaciones = relations(pedidos, ({ one, many }) => ({
  mesa: one(mesas, { fields: [pedidos.mesaId], references: [mesas.id] }),
  mesero: one(usuarios, { fields: [pedidos.meseroId], references: [usuarios.id] }),
  items: many(pedidoItems),
  comprobante: one(comprobantes, { fields: [pedidos.id], references: [comprobantes.pedidoId] }),
}));

export const pedidoItemsRelaciones = relations(pedidoItems, ({ one }) => ({
  pedido: one(pedidos, { fields: [pedidoItems.pedidoId], references: [pedidos.id] }),
}));

export const comprobantesRelaciones = relations(comprobantes, ({ one }) => ({
  pedido: one(pedidos, { fields: [comprobantes.pedidoId], references: [pedidos.id] }),
  emitidoPor: one(usuarios, { fields: [comprobantes.emitidoPorId], references: [usuarios.id] }),
  cierre: one(cierresCaja, { fields: [comprobantes.cierreId], references: [cierresCaja.id] }),
}));

export const cierresRelaciones = relations(cierresCaja, ({ one, many }) => ({
  responsable: one(usuarios, { fields: [cierresCaja.responsableId], references: [usuarios.id] }),
  comprobantes: many(comprobantes),
}));
