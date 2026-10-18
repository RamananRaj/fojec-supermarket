-- =====================================================================
-- FOJEC: Square connection + shop settings
-- Run in Supabase SQL Editor AFTER auth-and-admin.sql.
-- If prompted about RLS, choose "Run and enable RLS". Safe to re-run.
-- =====================================================================

-- 1. Square connection: one row per environment (sandbox / production).
--    Tokens are encrypted by the website before they are stored.
CREATE TABLE IF NOT EXISTS square_connection (
  environment TEXT PRIMARY KEY CHECK (environment IN ('sandbox', 'production')),
  merchant_id TEXT NOT NULL,
  merchant_name TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at TIMESTAMPTZ,
  location_id TEXT,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS on with NO policies: only the website's server (service role key)
-- can read or write this table. Browsers, customers and admins cannot.
ALTER TABLE square_connection ENABLE ROW LEVEL SECURITY;

-- 2. Shop settings: a single row (id = 1) the admin edits on Settings.
CREATE TABLE IF NOT EXISTS shop_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT DEFAULT 'Fojec Supermart',
  phone TEXT DEFAULT '0410 265 055',
  email TEXT DEFAULT 'fojecsupermart@gmail.com',
  opening_hours TEXT DEFAULT '7 days, 9:30am – 8:30pm',
  address TEXT,
  makeup_booking TEXT,
  out_of_stock_mode TEXT DEFAULT 'sold_out' CHECK (out_of_stock_mode IN ('sold_out', 'hide')),
  hold_back_qty INT DEFAULT 2 CHECK (hold_back_qty >= 0),
  click_and_collect BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO shop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read shop details (the public website shows them).
DROP POLICY IF EXISTS "public read shop settings" ON shop_settings;
CREATE POLICY "public read shop settings" ON shop_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Only admins can change them.
DROP POLICY IF EXISTS "admin update shop settings" ON shop_settings;
CREATE POLICY "admin update shop settings" ON shop_settings
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
