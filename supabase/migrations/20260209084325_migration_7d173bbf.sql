-- Drop and recreate the trigger function with correct column names
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_organization_name TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_unassigned_group_id UUID;
BEGIN
  -- Extract metadata
  v_organization_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'My Organization');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_phone := NEW.raw_user_meta_data->>'phone';

  -- Create tenant
  INSERT INTO tenants (name)
  VALUES (v_organization_name)
  RETURNING id INTO v_tenant_id;

  -- Create user profile with CORRECT column names
  INSERT INTO users (
    auth_user_id,
    tenant_id,
    email,
    name,
    phone_number,
    role,
    status
  ) VALUES (
    NEW.id,
    v_tenant_id,
    NEW.email,
    v_full_name,
    v_phone,
    'tenant_admin',
    'active'
  );

  -- Create default "Unassigned" group
  INSERT INTO groups (tenant_id, name, type)
  VALUES (v_tenant_id, 'Unassigned', 'operational')
  RETURNING id INTO v_unassigned_group_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();