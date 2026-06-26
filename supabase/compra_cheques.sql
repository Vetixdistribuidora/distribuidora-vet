-- Permite pagar a un PROVEEDOR con uno o varios cheques (endosando cheques
-- recibidos). Cada cheque queda enlazado a la compra y marcado como entregado.

CREATE TABLE IF NOT EXISTS compra_cheques (
  id            BIGSERIAL PRIMARY KEY,
  compra_id     BIGINT NOT NULL REFERENCES compras(id),
  cheque_id     BIGINT NOT NULL REFERENCES cheques(id),
  proveedor_id  BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compra_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON compra_cheques;
CREATE POLICY "Acceso autenticado" ON compra_cheques
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS compra_cheques_compra_idx ON compra_cheques(compra_id);
CREATE INDEX IF NOT EXISTS compra_cheques_cheque_idx ON compra_cheques(cheque_id);

NOTIFY pgrst, 'reload schema';
