-- Referência relacional equivalente ao JSON em server/data/bundles.json
-- (produção: Postgres / MySQL com transações ACID em inventário + saldo)

CREATE TABLE bundles (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  bundle_sku VARCHAR(128) NOT NULL,
  client_description TEXT,
  assembly_fee_usd DECIMAL(12,2) NOT NULL DEFAULT 2.00,
  setup_fee_usd DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, bundle_sku)
);

CREATE TABLE bundle_items (
  id BIGSERIAL PRIMARY KEY,
  bundle_id VARCHAR(32) NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  product_sku VARCHAR(128) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TABLE bundle_orders (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(16) NOT NULL,
  bundle_id VARCHAR(32) NOT NULL REFERENCES bundles(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(24) NOT NULL,
  total_fee_usd DECIMAL(12,2) NOT NULL,
  label_fnsku VARCHAR(64),
  qc_photo_url TEXT,
  picking_notes TEXT,
  batch_size INT,
  line_notes TEXT,
  assembly_group_id VARCHAR(36),
  group_line_index INT,
  group_line_count INT,
  reserved_deductions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bundle_orders_group ON bundle_orders(assembly_group_id);

CREATE TABLE bundle_order_logs (
  id BIGSERIAL PRIMARY KEY,
  bundle_order_id VARCHAR(32) NOT NULL REFERENCES bundle_orders(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL,
  changed_by VARCHAR(16) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bundle_orders_user ON bundle_orders(user_id);
CREATE INDEX idx_bundle_orders_status ON bundle_orders(status);
