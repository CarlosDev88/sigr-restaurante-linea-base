CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_nombre_unique` ON `categorias` (`nombre`);--> statement-breakpoint
CREATE TABLE `cierres_caja` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fecha_hora` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`responsable_id` integer NOT NULL,
	`total` integer NOT NULL,
	`cantidad_comprobantes` integer NOT NULL,
	FOREIGN KEY (`responsable_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comprobantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` integer NOT NULL,
	`pedido_id` integer NOT NULL,
	`total` integer NOT NULL,
	`emitido_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`emitido_por_id` integer NOT NULL,
	`cierre_id` integer,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`emitido_por_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cierre_id`) REFERENCES `cierres_caja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comprobantes_numero_unique` ON `comprobantes` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `comprobantes_pedido_id_unique` ON `comprobantes` (`pedido_id`);--> statement-breakpoint
CREATE TABLE `mesas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` integer NOT NULL,
	`capacidad` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mesas_numero_unique` ON `mesas` (`numero`);--> statement-breakpoint
CREATE TABLE `pedido_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pedido_id` integer NOT NULL,
	`plato_id` integer NOT NULL,
	`nombre_plato` text NOT NULL,
	`precio_unitario` integer NOT NULL,
	`cantidad` integer NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plato_id`) REFERENCES `platos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mesa_id` integer NOT NULL,
	`mesero_id` integer NOT NULL,
	`estado` text DEFAULT 'PENDIENTE' NOT NULL,
	`creado_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`actualizado_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`mesa_id`) REFERENCES `mesas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mesero_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `platos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text DEFAULT '' NOT NULL,
	`precio` integer NOT NULL,
	`disponible` integer DEFAULT true NOT NULL,
	`categoria_id` integer NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `reservas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente_id` integer NOT NULL,
	`mesa_id` integer NOT NULL,
	`inicio` integer NOT NULL,
	`fin` integer NOT NULL,
	`personas` integer NOT NULL,
	`estado` text DEFAULT 'PENDIENTE' NOT NULL,
	`creado_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mesa_id`) REFERENCES `mesas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reservas_mesa_inicio_idx` ON `reservas` (`mesa_id`,`inicio`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`rol` text NOT NULL,
	`creado_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);