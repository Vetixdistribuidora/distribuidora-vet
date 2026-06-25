-- Enlazar pagos de cuenta corriente con un cheque recibido (pestaña Cheques).
-- Permite registrar un pago hecho con cheque y detallarlo en el recibo.

ALTER TABLE pagos_cuenta_corriente
  ADD COLUMN IF NOT EXISTS cheque_id BIGINT REFERENCES cheques(id);

CREATE INDEX IF NOT EXISTS pagos_cc_cheque_idx
  ON pagos_cuenta_corriente(cheque_id);

NOTIFY pgrst, 'reload schema';
