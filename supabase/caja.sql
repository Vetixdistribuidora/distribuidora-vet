-- ============================================================
--  VETIX — CAJA / FLUJO DE CAJA
--  Ejecutar completo en Supabase → SQL Editor.
--  Es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLA movimientos_caja  (ingresos/egresos MANUALES)
--    Los movimientos automáticos (ventas cobradas, cobros de
--    cuenta corriente, pagos a proveedores) NO se guardan acá:
--    se calculan en vivo desde sus tablas de origen para no duplicar.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id              BIGSERIAL     PRIMARY KEY,
  fecha           DATE          NOT NULL DEFAULT CURRENT_DATE,
  tipo            TEXT          NOT NULL,              -- 'ingreso' | 'egreso'
  categoria       TEXT          NOT NULL,              -- 'retiro','flete','gasto_distribuidora','gasto_casa','gasto_camioneta','otro_ingreso','otro_egreso'
  metodo_pago     TEXT,                                -- 'efectivo','transferencia','cheque','echeq','tarjeta','otro'
  monto           NUMERIC(14,2) NOT NULL,
  descripcion     TEXT,
  organizacion_id UUID          REFERENCES organizaciones(id),
  created_at      TIMESTAMPTZ   DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. TABLA caja_config  (saldo inicial / punto de arranque)
--    Una fila por organización.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caja_config (
  id              BIGSERIAL     PRIMARY KEY,
  saldo_inicial   NUMERIC(14,2) NOT NULL DEFAULT 0,
  mes_inicial     TEXT          NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),  -- 'YYYY-MM'
  organizacion_id UUID          REFERENCES organizaciones(id),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

-- Un solo registro de config por organización
CREATE UNIQUE INDEX IF NOT EXISTS caja_config_org_uidx ON caja_config(organizacion_id);

-- ────────────────────────────────────────────────────────────
-- 3. COLUMNA metodo_pago en pagos_cuenta_corriente
--    (estructura el método de cobro de cuentas corrientes.
--     Los cobros viejos quedan NULL = "sin especificar".)
-- ────────────────────────────────────────────────────────────
ALTER TABLE pagos_cuenta_corriente ADD COLUMN IF NOT EXISTS metodo_pago TEXT;

-- ────────────────────────────────────────────────────────────
-- 4. ÍNDICES útiles
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS movimientos_caja_fecha_idx ON movimientos_caja(fecha DESC);
CREATE INDEX IF NOT EXISTS movimientos_caja_tipo_idx  ON movimientos_caja(tipo);

-- ────────────────────────────────────────────────────────────
-- 5. MULTI-TENANT: trigger de org_id + RLS por organización
--    (reusa _set_org_id() y get_my_org_id() de migration_multitenant.sql)
-- ────────────────────────────────────────────────────────────
-- Se escribe explícito por tabla (no en un loop) para que cada statement se aplique
-- de forma independiente y no quede una tabla con RLS activada pero SIN política
-- (RLS activa + sin política = se niega todo INSERT).

-- caja_config
ALTER TABLE caja_config ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS tg_set_org_id ON caja_config;
CREATE TRIGGER tg_set_org_id BEFORE INSERT ON caja_config
  FOR EACH ROW EXECUTE FUNCTION _set_org_id();
DROP POLICY IF EXISTS "org_isolation" ON caja_config;
CREATE POLICY "org_isolation" ON caja_config
  FOR ALL USING (organizacion_id = get_my_org_id())
  WITH CHECK (organizacion_id = get_my_org_id());

-- movimientos_caja
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS tg_set_org_id ON movimientos_caja;
CREATE TRIGGER tg_set_org_id BEFORE INSERT ON movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION _set_org_id();
DROP POLICY IF EXISTS "org_isolation" ON movimientos_caja;
CREATE POLICY "org_isolation" ON movimientos_caja
  FOR ALL USING (organizacion_id = get_my_org_id())
  WITH CHECK (organizacion_id = get_my_org_id());

-- ────────────────────────────────────────────────────────────
-- 6. Etiquetar filas pre-existentes (si las hubiera) con la org VETIX
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizaciones WHERE nombre = 'VETIX' LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    UPDATE movimientos_caja SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
    UPDATE caja_config      SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
--  FIN — Caja lista. Ejecutá este script una sola vez.
-- ============================================================
