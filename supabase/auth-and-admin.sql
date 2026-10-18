-- =====================================================================
-- FOJEC: Customer login + Admin access
-- Run in Supabase SQL Editor. If prompted about RLS, choose
-- "Run and enable RLS". Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).
-- =====================================================================

-- 1. Customer profile, one row per Supabase Auth user
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Admin list: a user is an admin only if they have a row here
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Helper: is the current logged-in user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

-- 4. Auto-create a profile whenever someone signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile read" ON profiles;
CREATE POLICY "own profile read" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "own profile update" ON profiles;
CREATE POLICY "own profile update" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin read all profiles" ON profiles;
CREATE POLICY "admin read all profiles" ON profiles
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "own admin check" ON admin_users;
CREATE POLICY "own admin check" ON admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. Admin-only write access to products (public read already exists)
DROP POLICY IF EXISTS "admin read all products" ON products;
CREATE POLICY "admin read all products" ON products
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin insert products" ON products;
CREATE POLICY "admin insert products" ON products
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin update products" ON products;
CREATE POLICY "admin update products" ON products
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin delete products" ON products;
CREATE POLICY "admin delete products" ON products
  FOR DELETE TO authenticated USING (is_admin());

-- =====================================================================
-- STEP AFTER RUNNING THE ABOVE:
-- 1. Register your admin account on the website (/login -> Sign up),
--    confirm the email, then run this with YOUR admin email:
-- =====================================================================
-- INSERT INTO admin_users (user_id)
-- SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
-- ON CONFLICT DO NOTHING;
