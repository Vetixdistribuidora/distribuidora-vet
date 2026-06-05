-- ============================================================
-- Tabla saldo_clientes — créditos a favor del cliente
-- (notas de crédito por devoluciones que les hacemos)
-- Espejo de saldo_proveedores. Ejecutar en Supabase → SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS saldo_clientes (
  id          BIGSERIAL PRIMARY KEY,
  cliente_id  BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto       NUMERIC(14,2) NOT NULL,
  notas       TEXT,
  fecha       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE saldo_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso autenticado saldo_clientes" ON saldo_clientes;
CREATE POLICY "Acceso autenticado saldo_clientes" ON saldo_clientes
  FOR ALL USING (auth.role() = 'authenticated');

-- Índice
CREATE INDEX IF NOT EXISTS saldo_clientes_cliente_idx ON saldo_clientes(cliente_id);

NOTIFY pgrst, 'reload schema';
