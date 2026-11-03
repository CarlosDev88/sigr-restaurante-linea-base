CREATE TABLE `factura_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factura_id` integer NOT NULL,
	`plato_id` integer,
	`descripcion` text NOT NULL,
	`cantidad` integer NOT NULL,
	`valor_unitario` integer NOT NULL,
	`valor_total` integer NOT NULL,
	FOREIGN KEY (`factura_id`) REFERENCES `facturas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`plato_id`) REFERENCES `platos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facturas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prefijo` text DEFAULT 'FA' NOT NULL,
	`numero` integer NOT NULL,
	`pedido_id` integer NOT NULL,
	`emitida_en` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`emitida_por_id` integer NOT NULL,
	`emisor_razon_social` text NOT NULL,
	`emisor_nit` text NOT NULL,
	`emisor_direccion` text NOT NULL,
	`emisor_telefono` text NOT NULL,
	`cliente_nombre` text DEFAULT 'Consumidor final' NOT NULL,
	`cliente_tipo_documento` text,
	`cliente_numero_documento` text,
	`cliente_email` text,
	`subtotal` integer NOT NULL,
	`tasa_impuesto_consumo` integer NOT NULL,
	`impuesto_consumo` integer NOT NULL,
	`total` integer NOT NULL,
	`medio_pago` text NOT NULL,
	`mesa_numero` integer NOT NULL,
	`cierre_id` integer,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`emitida_por_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cierre_id`) REFERENCES `cierres_caja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facturas_numero_unique` ON `facturas` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `facturas_pedido_id_unique` ON `facturas` (`pedido_id`);