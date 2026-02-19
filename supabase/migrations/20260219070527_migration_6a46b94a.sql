-- Add phone_number column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.phone_number IS 'User phone number in E.164 format (e.g., +4791234567)';