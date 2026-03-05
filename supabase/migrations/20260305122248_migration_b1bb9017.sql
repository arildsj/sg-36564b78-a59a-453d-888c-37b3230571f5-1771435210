-- FIX: Update bulk_campaigns INSERT policy to use correct column name
DROP POLICY IF EXISTS "bulk_campaigns_insert" ON bulk_campaigns;

CREATE POLICY "bulk_campaigns_insert"
ON bulk_campaigns FOR INSERT
WITH CHECK (
  (tenant_id = get_user_tenant_id()) 
  AND (created_by_user_id = auth.uid())  -- RIKTIG kolonnenavn!
  AND (is_tenant_admin() OR is_group_member(group_id))
);