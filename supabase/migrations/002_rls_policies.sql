-- SeMSe + FairGateway: Row Level Security Policies
-- PROMPT 1: Enforce tenant isolation and access control

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_duty_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelisted_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelisted_number_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_fallback_inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hour_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS for RLS
-- ============================================================================

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION auth.user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid() AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is tenant admin
CREATE OR REPLACE FUNCTION auth.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'tenant_admin' 
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get user's accessible group IDs (including groups they belong to)
CREATE OR REPLACE FUNCTION auth.user_group_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT group_id 
  FROM group_memberships 
  WHERE user_id = auth.uid() 
  AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is admin of specific group
CREATE OR REPLACE FUNCTION auth.is_group_admin(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships 
    WHERE user_id = auth.uid() 
    AND group_id = p_group_id 
    AND is_admin = true 
    AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- TENANTS: Only view own tenant
-- ============================================================================
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  USING (id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can update own tenant"
  ON tenants FOR UPDATE
  USING (id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- TENANT SETTINGS: Tenant-scoped access
-- ============================================================================
CREATE POLICY "Users can view own tenant settings"
  ON tenant_settings FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage tenant settings"
  ON tenant_settings FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- USER PROFILES: Same tenant visibility
-- ============================================================================
CREATE POLICY "Users can view profiles in same tenant"
  ON user_profiles FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Tenant admins can manage user profiles"
  ON user_profiles FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- GROUPS: Hierarchical access control
-- ============================================================================
CREATE POLICY "Users can view groups they belong to"
  ON groups FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id() 
    AND (
      auth.is_tenant_admin() 
      OR id IN (SELECT auth.user_group_ids())
    )
  );

CREATE POLICY "Tenant admins can manage groups"
  ON groups FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

CREATE POLICY "Group admins can update their groups"
  ON groups FOR UPDATE
  USING (
    tenant_id = auth.user_tenant_id() 
    AND auth.is_group_admin(id)
  );

-- ============================================================================
-- GROUP MEMBERSHIPS: View own memberships or managed groups
-- ============================================================================
CREATE POLICY "Users can view memberships in their groups"
  ON group_memberships FOR SELECT
  USING (
    group_id IN (SELECT auth.user_group_ids())
    OR user_id = auth.uid()
  );

CREATE POLICY "Tenant admins can manage all memberships"
  ON group_memberships FOR ALL
  USING (
    group_id IN (
      SELECT id FROM groups WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

CREATE POLICY "Group admins can manage their group memberships"
  ON group_memberships FOR ALL
  USING (auth.is_group_admin(group_id));

-- ============================================================================
-- ON-DUTY STATE: Users manage own state
-- ============================================================================
CREATE POLICY "Users can view on-duty state in their groups"
  ON on_duty_state FOR SELECT
  USING (group_id IN (SELECT auth.user_group_ids()));

CREATE POLICY "Users can manage own on-duty state"
  ON on_duty_state FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- CONTACTS: Group-scoped visibility
-- ============================================================================
CREATE POLICY "Users can view contacts in their groups"
  ON contacts FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id()
    AND (
      auth.is_tenant_admin()
      OR id IN (
        SELECT contact_id FROM group_contacts 
        WHERE group_id IN (SELECT auth.user_group_ids())
        AND deleted_at IS NULL
      )
    )
  );

CREATE POLICY "Tenant admins can manage contacts"
  ON contacts FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

CREATE POLICY "Group members can create contacts"
  ON contacts FOR INSERT
  WITH CHECK (tenant_id = auth.user_tenant_id());

-- ============================================================================
-- CONTACT PHONES: Follow contact access
-- ============================================================================
CREATE POLICY "Users can view phones for accessible contacts"
  ON contact_phones FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM contacts 
      WHERE tenant_id = auth.user_tenant_id()
      AND (
        auth.is_tenant_admin()
        OR id IN (
          SELECT contact_id FROM group_contacts 
          WHERE group_id IN (SELECT auth.user_group_ids())
          AND deleted_at IS NULL
        )
      )
    )
  );

CREATE POLICY "Users can manage phones for accessible contacts"
  ON contact_phones FOR ALL
  USING (
    contact_id IN (
      SELECT id FROM contacts WHERE tenant_id = auth.user_tenant_id()
    )
  );

-- ============================================================================
-- GROUP CONTACTS: Link contacts to accessible groups
-- ============================================================================
CREATE POLICY "Users can view group contacts for their groups"
  ON group_contacts FOR SELECT
  USING (group_id IN (SELECT auth.user_group_ids()));

CREATE POLICY "Tenant admins can manage group contacts"
  ON group_contacts FOR ALL
  USING (
    group_id IN (
      SELECT id FROM groups WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

CREATE POLICY "Group admins can manage their group contacts"
  ON group_contacts FOR ALL
  USING (auth.is_group_admin(group_id));

-- ============================================================================
-- WHITELISTED NUMBERS: Tenant-scoped
-- ============================================================================
CREATE POLICY "Users can view whitelisted numbers in tenant"
  ON whitelisted_numbers FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage whitelisted numbers"
  ON whitelisted_numbers FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- WHITELISTED NUMBER GROUP LINKS: Follow whitelist access
-- ============================================================================
CREATE POLICY "Users can view whitelist links for their groups"
  ON whitelisted_number_group_links FOR SELECT
  USING (
    group_id IN (SELECT auth.user_group_ids())
    OR whitelisted_number_id IN (
      SELECT id FROM whitelisted_numbers WHERE tenant_id = auth.user_tenant_id()
    )
  );

CREATE POLICY "Tenant admins can manage whitelist links"
  ON whitelisted_number_group_links FOR ALL
  USING (
    whitelisted_number_id IN (
      SELECT id FROM whitelisted_numbers WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

-- ============================================================================
-- GATEWAYS: Tenant-scoped
-- ============================================================================
CREATE POLICY "Users can view gateways in tenant"
  ON gateways FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage gateways"
  ON gateways FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- GATEWAY FALLBACK INBOXES: Follow gateway access
-- ============================================================================
CREATE POLICY "Users can view fallback inboxes"
  ON gateway_fallback_inboxes FOR SELECT
  USING (
    gateway_id IN (
      SELECT id FROM gateways WHERE tenant_id = auth.user_tenant_id()
    )
  );

CREATE POLICY "Tenant admins can manage fallback inboxes"
  ON gateway_fallback_inboxes FOR ALL
  USING (
    gateway_id IN (
      SELECT id FROM gateways WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

-- ============================================================================
-- MESSAGE THREADS: Group-scoped visibility
-- ============================================================================
CREATE POLICY "Users can view threads in their groups"
  ON message_threads FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id()
    AND group_id IN (SELECT auth.user_group_ids())
  );

CREATE POLICY "System can create/update threads"
  ON message_threads FOR ALL
  USING (tenant_id = auth.user_tenant_id());

-- ============================================================================
-- MESSAGES: Group-scoped, critical for tenant isolation
-- ============================================================================
CREATE POLICY "Users can view messages in their groups"
  ON messages FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id()
    AND resolved_group_id IN (SELECT auth.user_group_ids())
  );

CREATE POLICY "Users can send messages from their groups"
  ON messages FOR INSERT
  WITH CHECK (
    tenant_id = auth.user_tenant_id()
    AND resolved_group_id IN (SELECT auth.user_group_ids())
  );

CREATE POLICY "System can update message status"
  ON messages FOR UPDATE
  USING (tenant_id = auth.user_tenant_id());

-- ============================================================================
-- ROUTING RULES: Tenant admins only
-- ============================================================================
CREATE POLICY "Users can view routing rules in tenant"
  ON routing_rules FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage routing rules"
  ON routing_rules FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- AUTO REPLIES: Tenant/group scoped
-- ============================================================================
CREATE POLICY "Users can view auto replies"
  ON auto_replies FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id()
    AND (
      group_id IS NULL 
      OR group_id IN (SELECT auth.user_group_ids())
    )
  );

CREATE POLICY "Tenant admins can manage auto replies"
  ON auto_replies FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

CREATE POLICY "Group admins can manage group auto replies"
  ON auto_replies FOR ALL
  USING (
    tenant_id = auth.user_tenant_id()
    AND group_id IS NOT NULL
    AND auth.is_group_admin(group_id)
  );

-- ============================================================================
-- OPENING HOURS: Group-scoped
-- ============================================================================
CREATE POLICY "Users can view opening hours for their groups"
  ON opening_hours FOR SELECT
  USING (group_id IN (SELECT auth.user_group_ids()));

CREATE POLICY "Group admins can manage opening hours"
  ON opening_hours FOR ALL
  USING (auth.is_group_admin(group_id));

CREATE POLICY "Tenant admins can manage all opening hours"
  ON opening_hours FOR ALL
  USING (
    group_id IN (
      SELECT id FROM groups WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

-- ============================================================================
-- OPENING HOUR EXCEPTIONS: Group-scoped
-- ============================================================================
CREATE POLICY "Users can view opening exceptions for their groups"
  ON opening_hour_exceptions FOR SELECT
  USING (group_id IN (SELECT auth.user_group_ids()));

CREATE POLICY "Group admins can manage opening exceptions"
  ON opening_hour_exceptions FOR ALL
  USING (auth.is_group_admin(group_id));

CREATE POLICY "Tenant admins can manage all opening exceptions"
  ON opening_hour_exceptions FOR ALL
  USING (
    group_id IN (
      SELECT id FROM groups WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );

-- ============================================================================
-- BULK CAMPAIGNS: Group-scoped
-- ============================================================================
CREATE POLICY "Users can view campaigns in their groups"
  ON bulk_campaigns FOR SELECT
  USING (
    tenant_id = auth.user_tenant_id()
    AND group_id IN (SELECT auth.user_group_ids())
  );

CREATE POLICY "Users can create campaigns for their groups"
  ON bulk_campaigns FOR INSERT
  WITH CHECK (
    tenant_id = auth.user_tenant_id()
    AND group_id IN (SELECT auth.user_group_ids())
  );

CREATE POLICY "Campaign creators can manage their campaigns"
  ON bulk_campaigns FOR UPDATE
  USING (
    tenant_id = auth.user_tenant_id()
    AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Tenant admins can manage all campaigns"
  ON bulk_campaigns FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- BULK RECIPIENTS: Follow campaign access
-- ============================================================================
CREATE POLICY "Users can view recipients for accessible campaigns"
  ON bulk_recipients FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM bulk_campaigns 
      WHERE tenant_id = auth.user_tenant_id()
      AND group_id IN (SELECT auth.user_group_ids())
    )
  );

CREATE POLICY "System can manage bulk recipients"
  ON bulk_recipients FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM bulk_campaigns WHERE tenant_id = auth.user_tenant_id()
    )
  );

-- ============================================================================
-- DELIVERY STATUS EVENTS: System-managed, limited visibility
-- ============================================================================
CREATE POLICY "Users can view delivery events for their messages"
  ON delivery_status_events FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM messages 
      WHERE tenant_id = auth.user_tenant_id()
      AND resolved_group_id IN (SELECT auth.user_group_ids())
    )
  );

CREATE POLICY "System can manage delivery events"
  ON delivery_status_events FOR ALL
  USING (true); -- Managed by webhooks/edge functions

-- ============================================================================
-- AUDIT LOG: Read-only for tenant admins
-- ============================================================================
CREATE POLICY "Tenant admins can view audit log"
  ON audit_log FOR SELECT
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- No INSERT/UPDATE/DELETE policies - only via SECURITY DEFINER function

-- ============================================================================
-- IMPORT JOBS: Tenant-scoped
-- ============================================================================
CREATE POLICY "Users can view import jobs in tenant"
  ON import_jobs FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Users can create import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage import jobs"
  ON import_jobs FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- SIMULATION SCENARIOS: Tenant-scoped
-- ============================================================================
CREATE POLICY "Users can view simulation scenarios"
  ON simulation_scenarios FOR SELECT
  USING (tenant_id = auth.user_tenant_id());

CREATE POLICY "Tenant admins can manage simulation scenarios"
  ON simulation_scenarios FOR ALL
  USING (tenant_id = auth.user_tenant_id() AND auth.is_tenant_admin());

-- ============================================================================
-- SIMULATION EVENTS: Follow scenario access
-- ============================================================================
CREATE POLICY "Users can view simulation events"
  ON simulation_events FOR SELECT
  USING (
    scenario_id IN (
      SELECT id FROM simulation_scenarios 
      WHERE tenant_id = auth.user_tenant_id()
    )
  );

CREATE POLICY "Tenant admins can manage simulation events"
  ON simulation_events FOR ALL
  USING (
    scenario_id IN (
      SELECT id FROM simulation_scenarios 
      WHERE tenant_id = auth.user_tenant_id()
    )
    AND auth.is_tenant_admin()
  );