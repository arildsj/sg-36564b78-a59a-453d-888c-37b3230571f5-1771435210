-- Migration 001: Initial Schema
-- Run the complete initial schema setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TENANTS
-- =============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT,
  role TEXT NOT NULL CHECK (role IN ('tenant_admin', 'group_admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_auth ON users(auth_user_id);

-- =============================================================
-- GROUPS (Hierarchical with operational/structural distinction)
-- =============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('operational', 'structural')),
  timezone TEXT DEFAULT 'Europe/Oslo',
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_timeout_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_groups_parent ON groups(parent_group_id);
CREATE INDEX idx_groups_kind ON groups(kind);

-- =============================================================
-- GROUP MEMBERSHIP
-- =============================================================
CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_memberships_group ON group_memberships(group_id);
CREATE INDEX idx_memberships_user ON group_memberships(user_id);

-- =============================================================
-- ON-DUTY STATUS (per user per group)
-- =============================================================
CREATE TABLE on_duty_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_on_duty BOOLEAN NOT NULL DEFAULT false,
  last_toggled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_on_duty_group ON on_duty_status(group_id);
CREATE INDEX idx_on_duty_user ON on_duty_status(user_id);
CREATE INDEX idx_on_duty_active ON on_duty_status(group_id, is_on_duty);

-- =============================================================
-- GATEWAYS
-- =============================================================
CREATE TABLE gateways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  fallback_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  api_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number)
);

CREATE INDEX idx_gateways_tenant ON gateways(tenant_id);

-- =============================================================
-- WHITELISTED NUMBERS
-- =============================================================
CREATE TABLE whitelisted_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number)
);

CREATE INDEX idx_whitelist_tenant ON whitelisted_numbers(tenant_id);
CREATE INDEX idx_whitelist_phone ON whitelisted_numbers(phone_number);

-- =============================================================
-- WHITELIST <-> GROUP LINKS
-- =============================================================
CREATE TABLE whitelist_group_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whitelisted_number_id UUID NOT NULL REFERENCES whitelisted_numbers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(whitelisted_number_id, group_id)
);

CREATE INDEX idx_wgl_whitelist ON whitelist_group_links(whitelisted_number_id);
CREATE INDEX idx_wgl_group ON whitelist_group_links(group_id);

-- =============================================================
-- ROUTING RULES
-- =============================================================
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES gateways(id) ON DELETE CASCADE,
  target_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('prefix', 'keyword', 'fallback')),
  pattern TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_routing_tenant ON routing_rules(tenant_id);
CREATE INDEX idx_routing_gateway ON routing_rules(gateway_id);
CREATE INDEX idx_routing_priority ON routing_rules(priority DESC);

-- =============================================================
-- OPENING HOURS
-- =============================================================
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN DEFAULT true,
  open_time TIME,
  close_time TIME,
  UNIQUE(group_id, day_of_week)
);

CREATE INDEX idx_opening_hours_group ON opening_hours(group_id);

-- =============================================================
-- OPENING HOURS EXCEPTIONS
-- =============================================================
CREATE TABLE opening_hours_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_open BOOLEAN DEFAULT false,
  open_time TIME,
  close_time TIME,
  description TEXT,
  UNIQUE(group_id, exception_date)
);

CREATE INDEX idx_exceptions_group ON opening_hours_exceptions(group_id);
CREATE INDEX idx_exceptions_date ON opening_hours_exceptions(exception_date);

-- =============================================================
-- AUTOMATIC REPLIES
-- =============================================================
CREATE TABLE automatic_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('outside_hours', 'keyword', 'first_message')),
  trigger_pattern TEXT,
  message_template TEXT NOT NULL,
  cooldown_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auto_replies_group ON automatic_replies(group_id);
CREATE INDEX idx_auto_replies_trigger ON automatic_replies(trigger_type);

-- =============================================================
-- MESSAGES
-- =============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  thread_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  external_message_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_gateway ON messages(gateway_id);
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_thread ON messages(thread_key);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_acknowledged ON messages(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE UNIQUE INDEX idx_messages_external ON messages(gateway_id, external_message_id) WHERE external_message_id IS NOT NULL;

-- =============================================================
-- AUTO-REPLY LOG
-- =============================================================
CREATE TABLE auto_reply_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triggering_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  auto_reply_id UUID REFERENCES automatic_replies(id) ON DELETE SET NULL,
  sent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  was_sent BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auto_log_trigger ON auto_reply_log(triggering_message_id);

-- =============================================================
-- ESCALATION EVENTS
-- =============================================================
CREATE TABLE escalation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  escalated_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('timeout', 'manual', 'no_on_duty')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escalation_message ON escalation_events(message_id);
CREATE INDEX idx_escalation_group ON escalation_events(group_id);
CREATE INDEX idx_escalation_unresolved ON escalation_events(resolved_at) WHERE resolved_at IS NULL;

-- =============================================================
-- NOTIFICATION PREFERENCES
-- =============================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  only_when_on_duty BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);

-- =============================================================
-- BULK CAMPAIGNS
-- =============================================================
CREATE TABLE bulk_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON bulk_campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON bulk_campaigns(status);

-- =============================================================
-- BULK RECIPIENTS
-- =============================================================
CREATE TABLE bulk_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recipients_campaign ON bulk_recipients(campaign_id);
CREATE INDEX idx_recipients_status ON bulk_recipients(status);

-- =============================================================
-- SIMULATION SCENARIOS
-- =============================================================
CREATE TABLE simulation_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scenarios_tenant ON simulation_scenarios(tenant_id);

-- =============================================================
-- SIMULATION EVENTS
-- =============================================================
CREATE TABLE simulation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('inbound_sms', 'outbound_sms', 'routing_check', 'auto_reply_check')),
  event_data JSONB NOT NULL,
  expected_outcome JSONB,
  actual_outcome JSONB,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sim_events_scenario ON simulation_events(scenario_id);

-- =============================================================
-- AUDIT LOG
-- =============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- =============================================================
-- CSV IMPORT JOBS
-- =============================================================
CREATE TABLE csv_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('users', 'whitelisted_numbers', 'whitelist_links')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_tenant ON csv_import_jobs(tenant_id);
CREATE INDEX idx_import_jobs_status ON csv_import_jobs(status);

-- =============================================================
-- TRIGGERS FOR updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_gateways_updated_at BEFORE UPDATE ON gateways FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_whitelisted_numbers_updated_at BEFORE UPDATE ON whitelisted_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_routing_rules_updated_at BEFORE UPDATE ON routing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_automatic_replies_updated_at BEFORE UPDATE ON automatic_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_bulk_campaigns_updated_at BEFORE UPDATE ON bulk_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_simulation_scenarios_updated_at BEFORE UPDATE ON simulation_scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_csv_import_jobs_updated_at BEFORE UPDATE ON csv_import_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();