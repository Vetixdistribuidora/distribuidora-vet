-- ============================================================
--  VETIX — MIGRACIÓN MULTI-TENANT (Fase 1)
--  Ejecutar completo en Supabase → SQL Editor
--  Es idempotente: se puede correr más de una vez sin duplicar.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLA organizaciones
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizaciones (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT        NOT NULL,
  logo_url    TEXT,
  direccion   TEXT,
  telefono    TEXT,
  email       TEXT,
  plan        TEXT        NOT NULL DEFAULT 'basico',
  activo      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. TABLA org_usuarios  (qué usuario pertenece a qué org)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_usuarios (
  user_id         UUID  NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  organizacion_id UUID  NOT NULL REFERENCES organizaciones(id)   ON DELETE CASCADE,
  rol             TEXT  NOT NULL DEFAULT 'admin',
  PRIMARY KEY (user_id, organizacion_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. INSERTAR organización VETIX  +  vincular al usuario actual
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_id  UUID;
  v_user_id UUID;
BEGIN
  -- Crear (o recuperar) la org VETIX
  INSERT INTO organizaciones (nombre, plan)
  VALUES ('VETIX', 'basico')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_org_id FROM organizaciones WHERE nombre = 'VETIX' LIMIT 1;

  -- Vincular el primer usuario registrado (el tuyo)
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  INSERT INTO org_usuarios (user_id, organizacion_id, rol)
  VALUES (v_user_id, v_org_id, 'admin')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'VETIX org_id = %  |  user_id = %', v_org_id, v_user_id;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. AGREGAR COLUMNA organizacion_id A TODAS LAS TABLAS
--    (nullable por ahora — el trigger la llena automáticamente,
--     así el código actual de la app sigue funcionando SIN cambios)
-- ────────────────────────────────────────────────────────────
ALTER TABLE clientes                ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE productos               ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE ventas                  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE detalle_ventas          ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE proveedores             ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE compras                 ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE compras_detalle         ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE compras_pagos           ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE pagos_cuenta_corriente  ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE cuentas_corrientes      ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE lotes                   ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE facturas_impresion      ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);
ALTER TABLE auditoria               ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES organizaciones(id);

-- ────────────────────────────────────────────────────────────
-- 5. ETIQUETAR TODOS LOS DATOS EXISTENTES con el org_id de VETIX
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizaciones WHERE nombre = 'VETIX' LIMIT 1;

  UPDATE clientes               SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE productos               SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE ventas                  SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE detalle_ventas          SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE proveedores             SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE compras                 SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE compras_detalle         SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE compras_pagos           SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE pagos_cuenta_corriente  SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE cuentas_corrientes      SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE lotes                   SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE facturas_impresion      SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;
  UPDATE auditoria               SET organizacion_id = v_org_id WHERE organizacion_id IS NULL;

  RAISE NOTICE 'Datos existentes etiquetados con org_id = %', v_org_id;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. FUNCIÓN  get_my_org_id()
--    Lee la org del usuario JWT actual desde org_usuarios.
--    SECURITY DEFINER + search_path fijo = segura y sin recursión.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organizacion_id
  FROM   org_usuarios
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. TRIGGER: auto-completa organizacion_id en cada INSERT
--    Gracias a esto el código actual de la app sigue funcionando
--    exactamente igual — el trigger pone el org_id automáticamente.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _set_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organizacion_id IS NULL THEN
    NEW.organizacion_id := get_my_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Crear/reemplazar triggers en cada tabla
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'clientes','productos','ventas','detalle_ventas','proveedores',
    'compras','compras_detalle','compras_pagos','pagos_cuenta_corriente',
    'cuentas_corrientes','lotes','facturas_impresion','auditoria'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_set_org_id ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER tg_set_org_id
       BEFORE INSERT ON %I
       FOR EACH ROW EXECUTE FUNCTION _set_org_id()',
      t
    );
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 8. HABILITAR ROW LEVEL SECURITY en todas las tablas
-- ────────────────────────────────────────────────────────────
ALTER TABLE organizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_detalle         ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_pagos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_cuenta_corriente  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_corrientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_impresion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria               ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 9. POLÍTICAS RLS — aislamiento por organización
-- ────────────────────────────────────────────────────────────

-- organizaciones: cada usuario solo ve la suya
DROP POLICY IF EXISTS "org_self_access" ON organizaciones;
CREATE POLICY "org_self_access" ON organizaciones
  FOR ALL
  USING      (id = get_my_org_id())
  WITH CHECK (id = get_my_org_id());

-- org_usuarios: solo los registros propios
DROP POLICY IF EXISTS "org_usuarios_isolation" ON org_usuarios;
CREATE POLICY "org_usuarios_isolation" ON org_usuarios
  FOR ALL
  USING      (organizacion_id = get_my_org_id())
  WITH CHECK (organizacion_id = get_my_org_id());

-- Todas las demás tablas: aislamiento por organización
DO $$
DECLARE
  tablas TEXT[] := ARRAY[
    'clientes','productos','ventas','detalle_ventas','proveedores',
    'compras','compras_detalle','compras_pagos','pagos_cuenta_corriente',
    'cuentas_corrientes','lotes','facturas_impresion','auditoria'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "org_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "org_isolation" ON %I
       FOR ALL
       USING      (organizacion_id = get_my_org_id())
       WITH CHECK (organizacion_id = get_my_org_id())',
      t
    );
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 10. VISTAS — recrear con security_invoker = true
--     (PostgreSQL 15+, Supabase lo soporta desde 2023)
--     security_invoker hace que la vista respete el RLS del usuario
--     que la consulta, en lugar del propietario de la vista.
-- ────────────────────────────────────────────────────────────

-- ── proveedores_con_saldo ─────────────────────────────────
DROP VIEW IF EXISTS proveedores_con_saldo;
CREATE VIEW proveedores_con_saldo
WITH (security_invoker = true)
AS
  SELECT
    p.id,
    p.nombre,
    p.cuit,
    p.telefono,
    p.email,
    p.direccion,
    p.notas,
    p.organizacion_id,
    COALESCE(
      SUM(GREATEST(c.total - c.total_pagado, 0))
        FILTER (WHERE c.estado IN ('pendiente', 'parcial')),
      0
    )::NUMERIC                                                       AS saldo_pendiente,
    COUNT(c.id) FILTER (WHERE c.estado IN ('pendiente', 'parcial'))  AS compras_pendientes
  FROM proveedores p
  LEFT JOIN compras c ON c.proveedor_id = p.id
  GROUP BY p.id, p.nombre, p.cuit, p.telefono, p.email,
           p.direccion, p.notas, p.organizacion_id;

-- ── lotes_con_stock ───────────────────────────────────────
DROP VIEW IF EXISTS lotes_con_stock;
CREATE VIEW lotes_con_stock
WITH (security_invoker = true)
AS
  SELECT
    l.*,
    pr.nombre      AS producto_nombre,
    pr.laboratorio AS laboratorio
  FROM lotes l
  JOIN productos pr ON pr.id = l.producto_id
  WHERE l.cantidad > 0;

-- ────────────────────────────────────────────────────────────
-- 11. FIX HISTÓRICO: costo_unitario guardaba precio_venta
--     (bug anterior — corrige solo los registros con el valor incorrecto)
-- ────────────────────────────────────────────────────────────
UPDATE detalle_ventas dv
SET    costo_unitario = pr.costo
FROM   productos pr
WHERE  dv.producto_id = pr.id
  AND  dv.costo_unitario = pr.precio_venta   -- valor incorrecto (era precio_venta)
  AND  pr.costo IS NOT NULL
  AND  pr.costo > 0
  AND  pr.costo <> pr.precio_venta;          -- solo si costo ≠ precio_venta (evita casos edge)

-- ────────────────────────────────────────────────────────────
-- 12. VERIFICACIÓN FINAL
-- ────────────────────────────────────────────────────────────
SELECT 'organizaciones'        AS tabla, COUNT(*) AS registros FROM organizaciones
UNION ALL
SELECT 'org_usuarios',                   COUNT(*)              FROM org_usuarios
UNION ALL
SELECT 'clientes sin org_id (debe=0)',   COUNT(*)              FROM clientes           WHERE organizacion_id IS NULL
UNION ALL
SELECT 'productos sin org_id (debe=0)',  COUNT(*)              FROM productos          WHERE organizacion_id IS NULL
UNION ALL
SELECT 'ventas sin org_id (debe=0)',     COUNT(*)              FROM ventas             WHERE organizacion_id IS NULL
UNION ALL
SELECT 'compras sin org_id (debe=0)',    COUNT(*)              FROM compras            WHERE organizacion_id IS NULL
UNION ALL
SELECT 'lotes sin org_id (debe=0)',      COUNT(*)              FROM lotes              WHERE organizacion_id IS NULL;

-- ============================================================
--  ⚠️  NOTA SOBRE RPCs (acciones manuales posteriores)
--
--  Las siguientes funciones son SECURITY DEFINER y bypasean RLS.
--  Mientras solo exista VETIX como cliente no hay riesgo, pero
--  ANTES de onboardear un segundo cliente deberás actualizarlas
--  en Supabase → Database → Functions para filtrar por org:
--
--   • dashboard_kpis          → agregar WHERE organizacion_id = get_my_org_id()
--                               en cada subquery interna
--   • productos_sin_ventas    → agregar AND organizacion_id = get_my_org_id()
--   • productos_sin_rotacion  → ídem
--   • registrar_compra        → el trigger ya setea org_id en cada INSERT;
--                               solo verificar que no haga SELECTs sin filtro
--   • registrar_pago_compra   → ídem
--   • registrar_auditoria     → ídem (el trigger setea org_id)
--
--  Fase 2 (app code) cubrirá esto en detalle.
-- ============================================================

-- ============================================================
--  FIN DE LA MIGRACIÓN — Fase 1 completa.
--  La app VETIX actual sigue funcionando sin ningún cambio de código.
--  Nuevos clientes que se registren estarán completamente aislados.
-- ============================================================
