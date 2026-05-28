-- Tabla de cheques
CREATE TABLE IF NOT EXISTS cheques (
  id               BIGSERIAL PRIMARY KEY,
  dueno            TEXT,                              -- Dueño / firmante del cheque
  numero           TEXT NOT NULL,                     -- Número del cheque
  tipo             TEXT NOT NULL DEFAULT 'CH',        -- 'CH' | 'ECHEQ' | 'F_CHEQ'
  fecha            DATE,                              -- Fecha del cheque
  banco            TEXT,                              -- Banco emisor
  quien_entrego    TEXT,                              -- Quién lo entregó
  monto_egresado   NUMERIC(14,2) NOT NULL DEFAULT 0, -- Salida (cheque que damos)
  monto_ingresado  NUMERIC(14,2) NOT NULL DEFAULT 0, -- Entrada (cheque que recibimos)
  entregada_a      TEXT,                              -- A quién se entregó (SIVET, GANAFORT, etc.)
  pagado           BOOLEAN NOT NULL DEFAULT FALSE,
  rechazado        BOOLEAN NOT NULL DEFAULT FALSE,
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON cheques;
CREATE POLICY "Acceso autenticado" ON cheques
  FOR ALL USING (auth.role() = 'authenticated');

-- Índices útiles
CREATE INDEX IF NOT EXISTS cheques_fecha_idx ON cheques(fecha DESC);
CREATE INDEX IF NOT EXISTS cheques_tipo_idx  ON cheques(tipo);

NOTIFY pgrst, 'reload schema';
