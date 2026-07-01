-- ============================================================
-- Excluir productos "no reales" (saldos migrados del sistema viejo) de las
-- estadísticas de inventario y ganancia, SIN afectar la deuda (cuenta corriente).
-- ============================================================

-- 1. Bandera para marcar productos que no son mercadería/venta real
ALTER TABLE productos ADD COLUMN IF NOT EXISTS excluir_stats boolean NOT NULL DEFAULT false;

-- 2. Marcar el/los producto(s) de "saldo sistema viejo"
UPDATE productos SET excluir_stats = true WHERE nombre ILIKE '%sistema viejo%';

-- 3. Que NO cuenten como capital en stock (no es mercadería real).
--    El stock de estos productos es un placeholder; ponerlo en 0 los saca del
--    cálculo de capital en TODA la app (incluida la función dashboard_kpis).
UPDATE productos SET stock = 0 WHERE excluir_stats = true;

-- 4. Corregir la ganancia histórica: en las ventas de estos productos, poner
--    costo = precio → margen 0 (no son ventas de mercadería, son cobro de deuda vieja).
UPDATE detalle_ventas dv
SET    costo_unitario = dv.precio
FROM   productos p
WHERE  dv.producto_id = p.id AND p.excluir_stats = true;

NOTIFY pgrst, 'reload schema';
