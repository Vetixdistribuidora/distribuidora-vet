-- Ejecutar en Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS pedidos (
  id          BIGSERIAL PRIMARY KEY,
  nombre_proveedor TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'borrador',  -- borrador | enviado
  notas       TEXT,
  fecha_envio TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_items (
  id          BIGSERIAL PRIMARY KEY,
  pedido_id   BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_estado      ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_items_pedido ON pedidos_items(pedido_id);
