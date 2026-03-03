-- QUICK FIX: Deaktiver RLS midlertidig på user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Verifiser at vi nå kan se brukere
SELECT 
  id,
  email,
  full_name,
  role,
  tenant_id,
  status
FROM user_profiles
ORDER BY created_at DESC;