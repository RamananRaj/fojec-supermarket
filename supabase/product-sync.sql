-- =====================================================================
-- FOJEC: Products copied from Square
-- Run in Supabase SQL Editor AFTER square-integration.sql.
-- If prompted about RLS, choose "Run and enable RLS". Safe to re-run.
--
-- Square is the master for names, prices, categories and stock. The
-- website only adds its own extras (photo, description, featured, etc.).
-- The older "products" and "categories" tables are left as they are and
-- are no longer used by the admin or the shop pages.
-- =====================================================================

-- 1. Categories from Square
CREATE TABLE IF NOT EXISTS catalog_categories (
  square_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  show_online BOOLEAN DEFAULT TRUE,          -- website-only
  is_deleted BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sellable products: one row per Square item variation
CREATE TABLE IF NOT EXISTS catalog_products (
  square_variation_id TEXT PRIMARY KEY,
  square_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  item_name TEXT,
  variation_name TEXT,
  sku TEXT,
  category_square_id TEXT REFERENCES catalog_categories(square_id) ON DELETE SET NULL,
  price_cents INTEGER,                       -- NULL = no fixed price in Square
  currency TEXT DEFAULT 'AUD',
  track_inventory BOOLEAN DEFAULT FALSE,
  stock_qty NUMERIC,                         -- NULL when stock isn't tracked
  square_description TEXT,
  square_image_url TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  -- website-only extras (never overwritten by a sync)
  photo_url TEXT,
  website_description TEXT,
  search_keywords TEXT,
  show_online BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS catalog_products_item_idx ON catalog_products (square_item_id);
CREATE INDEX IF NOT EXISTS catalog_products_category_idx ON catalog_products (category_square_id);

-- 3. Sync history shown on Settings
CREATE TABLE IF NOT EXISTS sync_log (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  kind TEXT,                                 -- manual, webhook, nightly, edit
  status TEXT,                               -- ok, warning, error
  items INTEGER,
  message TEXT
);

-- 4. Row Level Security
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Shoppers can read products and categories (prices are public anyway).
DROP POLICY IF EXISTS "public read catalog categories" ON catalog_categories;
CREATE POLICY "public read catalog categories" ON catalog_categories
  FOR SELECT TO anon, authenticated USING (is_deleted = FALSE);

DROP POLICY IF EXISTS "public read catalog products" ON catalog_products;
CREATE POLICY "public read catalog products" ON catalog_products
  FOR SELECT TO anon, authenticated USING (is_deleted = FALSE);

-- Admins can change the website-only settings. Square data is rewritten
-- by every sync, so changes to Square fields here would not stick.
DROP POLICY IF EXISTS "admin update catalog categories" ON catalog_categories;
CREATE POLICY "admin update catalog categories" ON catalog_categories
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin update catalog products" ON catalog_products;
CREATE POLICY "admin update catalog products" ON catalog_products
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Only admins can read the sync history. Only the server writes it.
DROP POLICY IF EXISTS "admin read sync log" ON sync_log;
CREATE POLICY "admin read sync log" ON sync_log
  FOR SELECT TO authenticated USING (is_admin());
