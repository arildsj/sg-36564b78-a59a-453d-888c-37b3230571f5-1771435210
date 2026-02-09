-- Drop existing function if it exists
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create function to automatically create tenant and user after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id uuid;
  tenant_name text;
BEGIN
  -- Extract organization name from user metadata (we'll pass it during signup)
  tenant_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    'Organization for ' || NEW.email
  );

  -- Create tenant
  INSERT INTO tenants (name)
  VALUES (tenant_name)
  RETURNING id INTO new_tenant_id;

  -- Create user record
  INSERT INTO users (
    tenant_id,
    auth_user_id,
    name,
    email,
    phone_number,
    role,
    status
  )
  VALUES (
    new_tenant_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'tenant_admin',
    'active'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after user confirmation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;