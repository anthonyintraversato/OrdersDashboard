-- orders_snapshot: point-in-time capture of unfulfilled orders
CREATE TABLE IF NOT EXISTS orders_snapshot (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_price DECIMAL(10,2),
  line_items JSONB,
  line_items_count INTEGER,
  location VARCHAR(50),
  customer_name VARCHAR(255),
  cancel_reason VARCHAR(100),
  source_name VARCHAR(255),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(shopify_order_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_orders_snapshot_date ON orders_snapshot(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_orders_snapshot_shopify_id ON orders_snapshot(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_snapshot_channel ON orders_snapshot(channel);
CREATE INDEX IF NOT EXISTS idx_orders_snapshot_status ON orders_snapshot(status);

-- defect_events: individual defect occurrences
CREATE TABLE IF NOT EXISTS defect_events (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT,
  order_number VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  defect_type VARCHAR(50) NOT NULL,
  reason TEXT,
  detected_method VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_defect_events_created ON defect_events(created_at);
CREATE INDEX IF NOT EXISTS idx_defect_events_channel ON defect_events(channel);

-- daily_metrics: end-of-day summary
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_orders_received INTEGER,
  total_orders_fulfilled INTEGER,
  total_defects INTEGER,
  defect_rate DECIMAL(5,4),
  orders_remaining_unfulfilled INTEGER,
  defects_by_channel JSONB,
  defects_by_type JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- sync_log: track sync operations
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  records_processed INTEGER,
  errors JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON sync_log(started_at);

-- shopify_config: store OAuth tokens and settings
CREATE TABLE IF NOT EXISTS shopify_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
