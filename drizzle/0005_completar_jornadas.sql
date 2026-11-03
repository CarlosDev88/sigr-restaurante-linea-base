-- Completa la jornada (día calendario en Bogotá, UTC-5 sin horario de verano) de los datos existentes.
UPDATE `facturas` SET `jornada` = date(`emitida_en` / 1000, 'unixepoch', '-5 hours') WHERE `jornada` = '';
--> statement-breakpoint
-- Cierres anteriores a la v1.1.0: jornada = día (Bogotá) en que se hizo el cierre.
-- Nota: en la v1.0.0 un cierre podía agrupar ventas de varios días; esos cierres heredados se conservan tal cual.
UPDATE `cierres_caja` SET `jornada` = date(`fecha_hora` / 1000, 'unixepoch', '-5 hours') WHERE `jornada` = '';
--> statement-breakpoint
UPDATE `cierres_caja` SET `turno` = (
  SELECT x.`n` FROM (
    SELECT `id`, row_number() OVER (PARTITION BY `jornada` ORDER BY `fecha_hora`, `id`) AS `n` FROM `cierres_caja`
  ) x WHERE x.`id` = `cierres_caja`.`id`
) WHERE `turno` = 0;
