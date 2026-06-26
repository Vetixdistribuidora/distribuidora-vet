-- Permite pagar con VARIOS cheques un mismo cobro (cuenta corriente / deudores).
-- Cada cobro se identifica por su nro_recibo; acá se listan los cheques usados.

CREATE TABLE IF NOT EXISTS pago_cheques (
  id          BIGSERIAL PRIMARY KEY,
  nro_recibo  TEXT   NOT NULL,
  cheque_id   BIGINT NOT NULL REFERENCES cheques(id),
  cliente_id  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pago_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado" ON pago_cheques;
CREATE POLICY "Acceso autenticado" ON pago_cheques
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS pago_cheques_recibo_idx ON pago_cheques(nro_recibo);
CREATE INDEX IF NOT EXISTS pago_cheques_cheque_idx ON pago_cheques(cheque_id);

NOTIFY pgrst, 'reload schema';
