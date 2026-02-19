-- Drop the invalid foreign key constraint that references non-existent 'users' table
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Add comment to track the fix
COMMENT ON TABLE user_profiles IS 'User profiles - fixed FK constraint 2026-02-19 06:10';