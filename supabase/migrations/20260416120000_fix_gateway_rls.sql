-- ============================================================
-- FIX: sms_gateways RLS — ensure INSERT/UPDATE/DELETE policies are correct
--
-- Root cause of the 403 on gateway creation:
--   The INSERT payload was missing tenant_id entirely (client bug, fixed
--   separately in admin/index.tsx), so tenant_id = get_user_tenant_id()
--   evaluated to NULL and the WITH CHECK failed even for tenant_admin users.
--
-- This migration drops and recreates the write policies in their correct
-- form, using only functions that exist on this database (is_tenant_admin,
-- get_user_tenant_id). The SELECT policy is left untouched.
-- ============================================================

-- Drop existing write policies (SELECT policy is correct; leave it alone)
DROP POLICY IF EXISTS "sms_gateways_insert" ON sms_gateways;
DROP POLICY IF EXISTS "sms_gateways_update" ON sms_gateways;
DROP POLICY IF EXISTS "sms_gateways_delete" ON sms_gateways;

-- INSERT: tenant_admin only, row must belong to the caller's tenant
CREATE POLICY "sms_gateways_insert"
ON sms_gateways
FOR INSERT
WITH CHECK (
  is_tenant_admin()
  AND tenant_id = get_user_tenant_id()
);

-- UPDATE: same
CREATE POLICY "sms_gateways_update"
ON sms_gateways
FOR UPDATE
USING (
  is_tenant_admin()
  AND tenant_id = get_user_tenant_id()
);

-- DELETE: same
CREATE POLICY "sms_gateways_delete"
ON sms_gateways
FOR DELETE
USING (
  is_tenant_admin()
  AND tenant_id = get_user_tenant_id()
);

-- Ensure RLS is enabled (idempotent)
ALTER TABLE sms_gateways ENABLE ROW LEVEL SECURITY;
