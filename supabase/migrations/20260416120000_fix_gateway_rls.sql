-- ============================================================
-- FIX: sms_gateways RLS — align INSERT/UPDATE/DELETE with SELECT
--
-- Root cause of the 403 on gateway creation:
--   1. The INSERT payload was missing tenant_id entirely (client bug, fixed
--      separately in admin/index.tsx), so tenant_id = get_user_tenant_id()
--      evaluated to NULL and the WITH CHECK failed.
--   2. INSERT/UPDATE/DELETE were restricted to is_tenant_admin() only, while
--      SELECT already allows is_group_admin() as well — inconsistent.
--
-- This migration aligns all four operations so that both tenant_admin and
-- group_admin can manage gateways within their tenant, matching the pattern
-- used by routing_rules and whitelisted_numbers on this project.
-- ============================================================

-- Drop existing write policies (SELECT policy is correct; leave it alone)
DROP POLICY IF EXISTS "sms_gateways_insert" ON sms_gateways;
DROP POLICY IF EXISTS "sms_gateways_update" ON sms_gateways;
DROP POLICY IF EXISTS "sms_gateways_delete" ON sms_gateways;

-- INSERT: tenant_admin or group_admin, and row must belong to the caller's tenant
CREATE POLICY "sms_gateways_insert"
ON sms_gateways
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

-- UPDATE: same conditions checked on the existing row
CREATE POLICY "sms_gateways_update"
ON sms_gateways
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

-- DELETE: same conditions
CREATE POLICY "sms_gateways_delete"
ON sms_gateways
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

-- Ensure RLS is enabled (idempotent)
ALTER TABLE sms_gateways ENABLE ROW LEVEL SECURITY;
