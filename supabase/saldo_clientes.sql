-- ============================================================
-- Tabla saldo_clientes — créditos a favor de clientes
-- (generados por notas de crédito o pagos en exceso)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS saldo_clientes (
  id              BIGSERIAL PRIMARY KEY,
  cliente_id      BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto           NUMERIC(14,2) NOT NULL,
  motivo          TEXT NOT NULL DEFAULT 'nota_credito',
                  -- 'nota_credito' | 'pago_exceso' | 'ajuste_manual'
  nro_referencia  TEXT,          -- nro_nota de la NC que lo generó
  venta_origen_id BIGINT,        -- venta de origen (la que generó la NC)
  venta_aplicada_id BIGINT,      -- venta donde se aplicó el saldo
  usado           BOOLEAN NOT NULL DEFAULT FALSE,
  fecha           TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE saldo_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso autenticado saldo_clientes" ON saldo_clientes;
CREATE POLICY "Acceso autenticado saldo_clientes" ON saldo_clientes
  FOR ALL USING (auth.role() = 'authenticated');

-- Índices
CREATE INDEX IF NOT EXISTS saldo_clientes_cliente_idx ON saldo_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS saldo_clientes_usado_idx   ON saldo_clientes(usado);

-- ============================================================
-- MIGRACIÓN: convertir las 3 NCs existentes al nuevo sistema
-- Esto restaura los totales de las facturas y crea los
-- saldo_clientes correspondientes.
-- ============================================================

-- 1. Restaurar totales de ventas que fueron reducidos por las NCs
UPDATE ventas SET total = total + 10000.00    WHERE id = 5;   -- NC-00001
UPDATE ventas SET total = total + 241269.88   WHERE id = 41;  -- NC-00002
UPDATE ventas SET total = total + 55125.03    WHERE id = 71;  -- NC-00003

-- 2. Revertir los movimientos en cuentas_corrientes que hicieron las NCs
--    (agregamos una entrada positiva que anula la reducción original)
INSERT INTO cuentas_corrientes (cliente_id, venta_id, tipo, monto, saldo, fecha)
SELECT
  nc.cliente_id,
  nc.venta_id,
  'reversa_nc',
  nc.total,
  COALESCE(
    (SELECT saldo FROM cuentas_corrientes
     WHERE cliente_id = nc.cliente_id ORDER BY id DESC LIMIT 1),
    0
  ) + nc.total,
  NOW()
FROM notas_credito nc
WHERE nc.id IN (1, 2, 3);

-- 3. Crear saldo_clientes para las 3 NCs existentes
INSERT INTO saldo_clientes (cliente_id, monto, motivo, nro_referencia, venta_origen_id)
SELECT cliente_id, total, 'nota_credito', nro_nota, venta_id
FROM notas_credito
WHERE id IN (1, 2, 3);

NOTIFY pgrst, 'reload schema';
