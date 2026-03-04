-- ============================================
-- SEMSE 2.0 - FIX ALL REMAINING RECURSIVE POLICIES
-- Fix whitelisted_numbers, routing_rules, sms_gateways
-- ============================================

-- 1. DROP ALL OLD POLICIES ON PROBLEMATIC TABLES
DROP POLICY IF EXISTS "Users can view whitelisted numbers in their tenant" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Admins can insert whitelisted numbers" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Admins can update whitelisted numbers" ON whitelisted_numbers;
DROP POLICY IF EXISTS "Admins can delete whitelisted numbers" ON whitelisted_numbers;

DROP POLICY IF EXISTS "Authenticated users can view rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can insert rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can update rules" ON routing_rules;
DROP POLICY IF EXISTS "Authenticated users can delete rules" ON routing_rules;

DROP POLICY IF EXISTS "Authenticated users can view gateways" ON sms_gateways;
DROP POLICY IF EXISTS "Authenticated users can update gateways" ON sms_gateways;

-- 2. CREATE NEW ZERO-RECURSION POLICIES FOR WHITELISTED_NUMBERS
CREATE POLICY "whitelisted_numbers_select"
ON whitelisted_numbers
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "whitelisted_numbers_insert"
ON whitelisted_numbers
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "whitelisted_numbers_update"
ON whitelisted_numbers
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "whitelisted_numbers_delete"
ON whitelisted_numbers
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

-- 3. CREATE NEW POLICIES FOR ROUTING_RULES
-- Only tenant_admins and group_admins can manage routing rules
CREATE POLICY "routing_rules_select"
ON routing_rules
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "routing_rules_insert"
ON routing_rules
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "routing_rules_update"
ON routing_rules
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "routing_rules_delete"
ON routing_rules
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

-- 4. CREATE NEW POLICIES FOR SMS_GATEWAYS
-- Only tenant_admins can manage gateways
CREATE POLICY "sms_gateways_select"
ON sms_gateways
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR is_group_admin())
);

CREATE POLICY "sms_gateways_insert"
ON sms_gateways
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

CREATE POLICY "sms_gateways_update"
ON sms_gateways
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

CREATE POLICY "sms_gateways_delete"
ON sms_gateways
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

-- 5. VERIFY RLS IS ENABLED
ALTER TABLE whitelisted_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_gateways ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! 🎉 ALL RECURSIVE POLICIES FIXED!
-- ============================================