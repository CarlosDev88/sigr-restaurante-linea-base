CREATE UNIQUE INDEX `cierres_jornada_turno_unico` ON `cierres_caja` (`jornada`,`turno`);--> statement-breakpoint
CREATE INDEX `facturas_jornada_cierre_idx` ON `facturas` (`jornada`,`cierre_id`);