-- =====================================================================
-- FOJEC: Inventory screen
-- Run in Supabase SQL Editor AFTER product-sync.sql.
-- If prompted about RLS, choose "Run and enable RLS". Safe to re-run.
-- =====================================================================

-- 1. Per-product low-stock alert level (website-only; a sync never changes it)
ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5 CHECK (low_stock_alert >= 0);

-- 2. Stock changes recorded from the admin. Square holds the count itself;
--    this keeps the reason, the note and who made the change.
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id BIGSERIAL PRIMARY KEY,
  square_change_id TEXT UNIQUE,
  square_variation_id TEXT NOT NULL,
  product_name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('delivery', 'writeoff', 'stocktake')),
  quantity NUMERIC NOT NULL,
  before_qty NUMERIC,
  after_qty NUMERIC,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_adjustments_variation_idx ON stock_adjustments (square_variation_id, created_at DESC);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Admins can read the history. Only the website's server writes it.
DROP POLICY IF EXISTS "admin read stock adjustments" ON stock_adjustments;
CREATE POLICY "admin read stock adjustments" ON stock_adjustments
  FOR SELECT TO authenticated USING (is_admin());
