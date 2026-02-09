-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create improved function that handles metadata properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_full_name TEXT;
  v_phone TEXT;
  v_org_name TEXT;
BEGIN
  -- Extract metadata from raw_user_meta_data
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', v_full_name || '''s Organization');

  -- Create tenant
  INSERT INTO tenants (name)
  VALUES (v_org_name)
  RETURNING id INTO v_tenant_id;

  -- Create user profile
  INSERT INTO users (
    id,
    tenant_id,
    email,
    full_name,
    phone,
    role,
    is_active
  ) VALUES (
    NEW.id,
    v_tenant_id,
    NEW.email,
    v_full_name,
    v_phone,
    'tenant_admin',
    true
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger AFTER insert to ensure auth.users is committed first
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();