-- ============================================================
-- Agregar columna "perdida" a la tabla productos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS perdida NUMERIC(5,2) NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
