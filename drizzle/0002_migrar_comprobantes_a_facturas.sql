-- Migración de datos v1.0.0 → v1.1.0: cada comprobante interno se convierte en una factura
-- académica con el mismo número, total y cierre. Los datos del emisor se toman de los valores
-- por defecto de la versión (src/lib/domain/restaurante.ts); el cliente queda como consumidor final
-- y el medio de pago como NO_REGISTRADO (la v1.0.0 no lo guardaba).
INSERT INTO `facturas` (
  `id`, `prefijo`, `numero`, `pedido_id`, `emitida_en`, `emitida_por_id`,
  `emisor_razon_social`, `emisor_nit`, `emisor_direccion`, `emisor_telefono`,
  `cliente_nombre`, `subtotal`, `tasa_impuesto_consumo`, `impuesto_consumo`, `total`,
  `medio_pago`, `mesa_numero`, `cierre_id`
)
SELECT
  c.`id`, 'FA', c.`numero`, c.`pedido_id`, c.`emitido_en`, c.`emitido_por_id`,
  'SIGR Restaurante Académico S.A.S.', '900.000.000-0', 'Calle de ejemplo # 00-00, Bucaramanga, Santander', '+57 607 000 0000',
  'Consumidor final',
  CAST(ROUND(c.`total` / 1.08) AS INTEGER), 8, c.`total` - CAST(ROUND(c.`total` / 1.08) AS INTEGER), c.`total`,
  'NO_REGISTRADO', m.`numero`, c.`cierre_id`
FROM `comprobantes` c
JOIN `pedidos` p ON p.`id` = c.`pedido_id`
JOIN `mesas` m ON m.`id` = p.`mesa_id`;
--> statement-breakpoint
INSERT INTO `factura_items` (`factura_id`, `plato_id`, `descripcion`, `cantidad`, `valor_unitario`, `valor_total`)
SELECT f.`id`, i.`plato_id`, i.`nombre_plato`, i.`cantidad`, i.`precio_unitario`, i.`cantidad` * i.`precio_unitario`
FROM `facturas` f
JOIN `pedido_items` i ON i.`pedido_id` = f.`pedido_id`
ORDER BY f.`id`, i.`id`;
