ALTER TABLE `cierres_caja` ADD `jornada` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cierres_caja` ADD `turno` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `facturas` ADD `jornada` text DEFAULT '' NOT NULL;