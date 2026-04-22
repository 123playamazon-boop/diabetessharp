-- Referência: equivalente relacional do modelo JSON em server/data/assisted-purchases.json
-- (a demo usa ficheiros; em produção migraria para Postgres/MySQL.)

CREATE TABLE assisted_purchases (
  id VARCHAR(64) PRIMARY KEY,
  suite VARCHAR(32) NOT NULL,
  product_url TEXT NOT NULL,
  product_title TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 1),
  notes TEXT NOT NULL DEFAULT '',
  estimated_unit_price_usd DECIMAL(12,2) NOT NULL,
  estimated_product_subtotal_usd DECIMAL(12,2) NOT NULL,
  service_fee_rate DECIMAL(6,4) NOT NULL DEFAULT 0.1000,
  estimated_service_fee_usd DECIMAL(12,2) NOT NULL,
  florida_tax_rate DECIMAL(6,4),
  florida_tax_usd DECIMAL(12,2),
  estimated_total_usd DECIMAL(12,2) NOT NULL,
  product_image_url TEXT,
  registered_unit_price_usd DECIMAL(12,2),
  link_scrape_unit_price_usd DECIMAL(12,2),
  link_scrape_at TIMESTAMPTZ,
  final_unit_price_usd DECIMAL(12,2),
  final_product_subtotal_usd DECIMAL(12,2),
  final_service_fee_usd DECIMAL(12,2),
  final_florida_tax_usd DECIMAL(12,2),
  final_total_usd DECIMAL(12,2),
  status VARCHAR(40) NOT NULL,
  admin_notes TEXT,
  store_order_id VARCHAR(128),
  tracking_number VARCHAR(128),
  store_name VARCHAR(128),
  debited_usd DECIMAL(12,2),
  debited_at TIMESTAMPTZ,
  customer_approved_at TIMESTAMPTZ,
  required_delivery_by_date DATE,
  client_notifications JSONB,
  admin_checklist JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assisted_purchases_suite ON assisted_purchases (suite);
CREATE INDEX idx_assisted_purchases_status ON assisted_purchases (status);
