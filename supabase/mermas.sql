-- ============================================================
-- Tabla de mermas (pérdidas por vencimiento, daño, robo, etc.)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS mermas (
  id                BIGSERIAL PRIMARY KEY,
  producto_id       BIGINT REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre   TEXT NOT NULL,                  -- denormalizado para historial
  cantidad          NUMERIC(10,3) NOT NULL DEFAULT 1,
  motivo            TEXT NOT NULL DEFAULT 'vencimiento',
                                                    -- 'vencimiento' | 'daño' | 'robo' | 'otro'
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  costo_unitario    NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta_ref  NUMERIC(14,2) NOT NULL DEFAULT 0,
  lote              TEXT,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado mermas" ON mermas;
CREATE POLICY "Acceso autenticado mermas" ON mermas
  FOR ALL USING (auth.role() = 'authenticated');

-- Índices útiles
CREATE INDEX IF NOT EXISTS mermas_fecha_idx        ON mermas(fecha DESC);
CREATE INDEX IF NOT EXISTS mermas_producto_idx     ON mermas(producto_id);
CREATE INDEX IF NOT EXISTS mermas_motivo_idx       ON mermas(motivo);

NOTIFY pgrst, 'reload schema';
