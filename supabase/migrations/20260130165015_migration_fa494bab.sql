-- Migration 002: RLS Policies (Fixed - using public schema)
-- Row Level Security for tenant isolation and access control

-- =============================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_duty_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelisted_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automatic_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_jobs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- HELPER FUNCTION: Get current user's tenant_id
-- =============================================================
CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================
-- HELPER FUNCTION: Check if user is tenant admin
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'tenant_admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================
-- HELPER FUNCTION: Check if user is group admin for a group
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_group_admin_for(group_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.group_memberships gm ON gm.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND gm.group_id = group_uuid
    AND u.role IN ('tenant_admin', 'group_admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================
-- HELPER FUNCTION: Get current user's ID
-- =============================================================
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================
-- TENANTS: Only tenant admins can manage
-- =============================================================
CREATE POLICY "Tenant admins can view their tenant" ON tenants
  FOR SELECT USING (id = public.user_tenant_id());

CREATE POLICY "Tenant admins can update their tenant" ON tenants
  FOR UPDATE USING (id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- USERS: Tenant-scoped access
-- =============================================================
CREATE POLICY "Users can view users in their tenant" ON users
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Tenant admins can insert users" ON users
  FOR INSERT WITH CHECK (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

CREATE POLICY "Tenant admins can update users" ON users
  FOR UPDATE USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

CREATE POLICY "Tenant admins can delete users" ON users
  FOR DELETE USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- GROUPS: Tenant-scoped access
-- =============================================================
CREATE POLICY "Users can view groups in their tenant" ON groups
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Tenant admins can insert groups" ON groups
  FOR INSERT WITH CHECK (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

CREATE POLICY "Admins can update groups" ON groups
  FOR UPDATE USING (
    tenant_id = public.user_tenant_id() 
    AND (public.is_tenant_admin() OR public.is_group_admin_for(id))
  );

CREATE POLICY "Tenant admins can delete groups" ON groups
  FOR DELETE USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- GROUP MEMBERSHIPS: Members can view, admins can manage
-- =============================================================
CREATE POLICY "Users can view memberships in their tenant" ON group_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_memberships.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can insert memberships" ON group_memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_memberships.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

CREATE POLICY "Admins can delete memberships" ON group_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_memberships.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

-- =============================================================
-- ON-DUTY STATUS: Members can toggle own, admins can manage all
-- =============================================================
CREATE POLICY "Users can view on-duty status in their tenant" ON on_duty_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = on_duty_status.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Users can update their own on-duty status" ON on_duty_status
  FOR UPDATE USING (
    user_id = public.current_user_id()
    AND EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = on_duty_status.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can update any on-duty status" ON on_duty_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = on_duty_status.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

CREATE POLICY "Admins can insert on-duty status" ON on_duty_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = on_duty_status.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

-- =============================================================
-- GATEWAYS: Tenant-scoped, admin-managed
-- =============================================================
CREATE POLICY "Users can view gateways in their tenant" ON gateways
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Tenant admins can manage gateways" ON gateways
  FOR ALL USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- WHITELISTED NUMBERS: Tenant-scoped
-- =============================================================
CREATE POLICY "Users can view whitelisted numbers in their tenant" ON whitelisted_numbers
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Admins can manage whitelisted numbers" ON whitelisted_numbers
  FOR ALL USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- WHITELIST GROUP LINKS: Tenant-scoped via group
-- =============================================================
CREATE POLICY "Users can view whitelist links in their tenant" ON whitelist_group_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = whitelist_group_links.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can manage whitelist links" ON whitelist_group_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = whitelist_group_links.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND public.is_tenant_admin()
    )
  );

-- =============================================================
-- ROUTING RULES: Tenant-scoped, admin-managed
-- =============================================================
CREATE POLICY "Users can view routing rules in their tenant" ON routing_rules
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Tenant admins can manage routing rules" ON routing_rules
  FOR ALL USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- OPENING HOURS: Group members can view, admins can manage
-- =============================================================
CREATE POLICY "Users can view opening hours for their groups" ON opening_hours
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = opening_hours.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can manage opening hours" ON opening_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = opening_hours.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

-- =============================================================
-- OPENING HOURS EXCEPTIONS: Same as opening hours
-- =============================================================
CREATE POLICY "Users can view opening hours exceptions" ON opening_hours_exceptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = opening_hours_exceptions.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can manage opening hours exceptions" ON opening_hours_exceptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = opening_hours_exceptions.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

-- =============================================================
-- AUTOMATIC REPLIES: Group-scoped, admin-managed
-- =============================================================
CREATE POLICY "Users can view automatic replies for their groups" ON automatic_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = automatic_replies.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Admins can manage automatic replies" ON automatic_replies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = automatic_replies.group_id 
      AND g.tenant_id = public.user_tenant_id()
      AND (public.is_tenant_admin() OR public.is_group_admin_for(g.id))
    )
  );

-- =============================================================
-- MESSAGES: Tenant-scoped, members can view their group messages
-- =============================================================
CREATE POLICY "Users can view messages in their tenant" ON messages
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Users can insert messages in their tenant" ON messages
  FOR INSERT WITH CHECK (tenant_id = public.user_tenant_id());

CREATE POLICY "Users can update messages in their tenant" ON messages
  FOR UPDATE USING (tenant_id = public.user_tenant_id());

-- =============================================================
-- AUTO-REPLY LOG: Tenant-scoped, read-only for members
-- =============================================================
CREATE POLICY "Users can view auto-reply log in their tenant" ON auto_reply_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m 
      WHERE m.id = auto_reply_log.triggering_message_id 
      AND m.tenant_id = public.user_tenant_id()
    )
  );

-- =============================================================
-- ESCALATION EVENTS: Tenant-scoped
-- =============================================================
CREATE POLICY "Users can view escalation events in their tenant" ON escalation_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = escalation_events.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "System can insert escalation events" ON escalation_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = escalation_events.group_id 
      AND g.tenant_id = public.user_tenant_id()
    )
  );

-- =============================================================
-- NOTIFICATION PREFERENCES: Users manage their own
-- =============================================================
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (user_id = public.current_user_id());

CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = public.current_user_id());

-- =============================================================
-- BULK CAMPAIGNS: Tenant-scoped
-- =============================================================
CREATE POLICY "Users can view bulk campaigns in their tenant" ON bulk_campaigns
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Authorized users can create bulk campaigns" ON bulk_campaigns
  FOR INSERT WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND created_by_user_id = public.current_user_id()
  );

CREATE POLICY "Authorized users can update bulk campaigns" ON bulk_campaigns
  FOR UPDATE USING (tenant_id = public.user_tenant_id());

-- =============================================================
-- BULK RECIPIENTS: Via campaign
-- =============================================================
CREATE POLICY "Users can view bulk recipients for their campaigns" ON bulk_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bulk_campaigns bc 
      WHERE bc.id = bulk_recipients.campaign_id 
      AND bc.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Users can manage bulk recipients for their campaigns" ON bulk_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bulk_campaigns bc 
      WHERE bc.id = bulk_recipients.campaign_id 
      AND bc.tenant_id = public.user_tenant_id()
    )
  );

-- =============================================================
-- SIMULATION SCENARIOS: Tenant-scoped
-- =============================================================
CREATE POLICY "Users can view simulation scenarios in their tenant" ON simulation_scenarios
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Admins can manage simulation scenarios" ON simulation_scenarios
  FOR ALL USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());

-- =============================================================
-- SIMULATION EVENTS: Via scenario
-- =============================================================
CREATE POLICY "Users can view simulation events for their scenarios" ON simulation_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM simulation_scenarios ss 
      WHERE ss.id = simulation_events.scenario_id 
      AND ss.tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Users can manage simulation events for their scenarios" ON simulation_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM simulation_scenarios ss 
      WHERE ss.id = simulation_events.scenario_id 
      AND ss.tenant_id = public.user_tenant_id()
    )
  );

-- =============================================================
-- AUDIT LOG: Tenant-scoped, read-only
-- =============================================================
CREATE POLICY "Users can view audit log in their tenant" ON audit_log
  FOR SELECT USING (tenant_id = public.user_tenant_id());

-- =============================================================
-- CSV IMPORT JOBS: Tenant-scoped
-- =============================================================
CREATE POLICY "Users can view CSV import jobs in their tenant" ON csv_import_jobs
  FOR SELECT USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Admins can create CSV import jobs" ON csv_import_jobs
  FOR INSERT WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND created_by_user_id = public.current_user_id()
    AND public.is_tenant_admin()
  );

CREATE POLICY "Admins can update CSV import jobs" ON csv_import_jobs
  FOR UPDATE USING (tenant_id = public.user_tenant_id() AND public.is_tenant_admin());