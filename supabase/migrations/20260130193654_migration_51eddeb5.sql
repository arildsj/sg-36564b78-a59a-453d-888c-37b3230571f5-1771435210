-- Ensure Tenant Admins can ALWAYS create groups
DROP POLICY IF EXISTS "Tenant admins can create groups" ON groups;

CREATE POLICY "Tenant admins can create groups" ON groups
  FOR INSERT
  WITH CHECK (
    tenant_id = user_tenant_id() AND
    is_tenant_admin()
  );