-- SeMSe + FairGateway: Initial Schema Migration
-- PROMPT 1: Multi-tenant B2B SMS/MMS Platform
-- All tables use UUID primary keys, soft deletes, and tenant isolation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TENANTS: Root isolation boundary
-- ============================================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- TENANT SETTINGS: Configuration per tenant
-- ============================================================================
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  business_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  default_country_code TEXT NOT NULL DEFAULT 'US',
  max_retry_attempts INTEGER NOT NULL DEFAULT 3,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id)
);

-- ============================================================================
-- USER PROFILES: Internal actors (→ auth.users)
-- ============================================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('tenant_admin', 'group_admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_email ON user_profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_role ON user_profiles(tenant_id, role) WHERE deleted_at IS NULL;

-- ============================================================================
-- GROUPS: Hierarchical organizational structure
-- ============================================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('structural', 'operational')),
  description TEXT,
  path TEXT[], -- Materialized path for hierarchy queries
  depth INTEGER NOT NULL DEFAULT 0,
  escalation_enabled BOOLEAN NOT NULL DEFAULT false,
  escalation_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  min_on_duty_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_groups_tenant ON groups(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_groups_parent ON groups(parent_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_groups_kind ON groups(tenant_id, kind) WHERE deleted_at IS NULL;
CREATE INDEX idx_groups_path ON groups USING GIN(path) WHERE deleted_at IS NULL;

-- ============================================================================
-- GROUP MEMBERSHIPS: User ↔ Group relationships
-- ============================================================================
CREATE TABLE group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, group_id)
);

CREATE INDEX idx_group_memberships_user ON group_memberships(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_memberships_group ON group_memberships(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_memberships_admin ON group_memberships(group_id, is_admin) WHERE deleted_at IS NULL AND is_admin = true;

-- ============================================================================
-- ON-DUTY STATE: Availability per operational group
-- ============================================================================
CREATE TABLE on_duty_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_on_duty BOOLEAN NOT NULL DEFAULT false,
  last_toggled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX idx_on_duty_user ON on_duty_state(user_id);
CREATE INDEX idx_on_duty_group ON on_duty_state(group_id) WHERE is_on_duty = true;

-- ============================================================================
-- CONTACTS: External parties (never users)
-- ============================================================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_name ON contacts(tenant_id, first_name, last_name) WHERE deleted_at IS NULL;

-- ============================================================================
-- CONTACT PHONES: E.164 formatted phone numbers
-- ============================================================================
CREATE TABLE contact_phones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- E.164 format
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contact_phones_contact ON contact_phones(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contact_phones_number ON contact_phones(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_contact_phones_primary ON contact_phones(contact_id, is_primary) WHERE deleted_at IS NULL AND is_primary = true;

-- ============================================================================
-- GROUP CONTACTS: Contact ↔ Group relationships (M:N)
-- ============================================================================
CREATE TABLE group_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(group_id, contact_id)
);

CREATE INDEX idx_group_contacts_group ON group_contacts(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_contacts_contact ON group_contacts(contact_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- WHITELISTED NUMBERS: Allowed external numbers
-- ============================================================================
CREATE TABLE whitelisted_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- E.164 format
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, phone_number)
);

CREATE INDEX idx_whitelisted_numbers_tenant ON whitelisted_numbers(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_whitelisted_numbers_phone ON whitelisted_numbers(phone_number) WHERE deleted_at IS NULL;

-- ============================================================================
-- WHITELISTED NUMBER GROUP LINKS: Whitelist ↔ Group
-- ============================================================================
CREATE TABLE whitelisted_number_group_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whitelisted_number_id UUID NOT NULL REFERENCES whitelisted_numbers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(whitelisted_number_id, group_id)
);

CREATE INDEX idx_whitelist_group_links_number ON whitelisted_number_group_links(whitelisted_number_id);
CREATE INDEX idx_whitelist_group_links_group ON whitelisted_number_group_links(group_id);

-- ============================================================================
-- GATEWAYS: FairGateway instances
-- ============================================================================
CREATE TABLE gateways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL, -- E.164 format
  api_key_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_gateways_tenant ON gateways(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_gateways_phone ON gateways(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_gateways_status ON gateways(tenant_id, status) WHERE deleted_at IS NULL;

-- ============================================================================
-- GATEWAY FALLBACK INBOXES: Default routing per gateway
-- ============================================================================
CREATE TABLE gateway_fallback_inboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gateway_id)
);

CREATE INDEX idx_gateway_fallback_gateway ON gateway_fallback_inboxes(gateway_id);
CREATE INDEX idx_gateway_fallback_group ON gateway_fallback_inboxes(group_id);

-- ============================================================================
-- MESSAGE THREADS: Conversation grouping
-- ============================================================================
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  external_number TEXT NOT NULL, -- E.164 format
  gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_threads_tenant ON message_threads(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_threads_group ON message_threads(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_threads_external ON message_threads(external_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_threads_last_message ON message_threads(group_id, last_message_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- MESSAGES: SMS/MMS records
-- ============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  resolved_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL, -- E.164 format
  to_number TEXT NOT NULL, -- E.164 format
  content TEXT,
  mms_media_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
  idempotency_key TEXT UNIQUE,
  external_id TEXT, -- FairGateway message ID
  sent_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  escalated_at TIMESTAMPTZ,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_tenant ON messages(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_group ON messages(resolved_group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_direction ON messages(tenant_id, direction, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_status ON messages(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_idempotency ON messages(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_messages_external_id ON messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_messages_unacknowledged ON messages(resolved_group_id, acknowledged_at, created_at) WHERE direction = 'inbound' AND acknowledged_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_messages_escalation ON messages(escalated_at, escalation_level) WHERE direction = 'inbound' AND deleted_at IS NULL;

-- ============================================================================
-- ROUTING RULES: Dynamic message routing logic
-- ============================================================================
CREATE TABLE routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES gateways(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  match_type TEXT NOT NULL CHECK (match_type IN ('keyword', 'sender', 'regex', 'time_based')),
  match_value TEXT NOT NULL,
  target_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_routing_rules_tenant ON routing_rules(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routing_rules_gateway ON routing_rules(gateway_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routing_rules_priority ON routing_rules(tenant_id, priority DESC, is_active) WHERE deleted_at IS NULL;

-- ============================================================================
-- AUTO REPLIES: Automated response templates
-- ============================================================================
CREATE TABLE auto_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'after_hours', 'first_message')),
  trigger_value TEXT,
  reply_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_auto_replies_tenant ON auto_replies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_auto_replies_group ON auto_replies(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_auto_replies_trigger ON auto_replies(trigger_type, is_active) WHERE deleted_at IS NULL;

-- ============================================================================
-- OPENING HOURS: Business hours per group
-- ============================================================================
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(group_id, day_of_week)
);

CREATE INDEX idx_opening_hours_group ON opening_hours(group_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- OPENING HOUR EXCEPTIONS: Holiday/special hours
-- ============================================================================
CREATE TABLE opening_hour_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT true,
  open_time TIME,
  close_time TIME,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(group_id, exception_date)
);

CREATE INDEX idx_opening_exceptions_group ON opening_hour_exceptions(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_opening_exceptions_date ON opening_hour_exceptions(exception_date) WHERE deleted_at IS NULL;

-- ============================================================================
-- BULK CAMPAIGNS: Mass SMS/MMS campaigns
-- ============================================================================
CREATE TABLE bulk_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_bulk_campaigns_tenant ON bulk_campaigns(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bulk_campaigns_group ON bulk_campaigns(group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bulk_campaigns_status ON bulk_campaigns(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- BULK RECIPIENTS: Per-recipient tracking
-- ============================================================================
CREATE TABLE bulk_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL, -- E.164 format
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bulk_recipients_campaign ON bulk_recipients(campaign_id);
CREATE INDEX idx_bulk_recipients_status ON bulk_recipients(campaign_id, status);
CREATE INDEX idx_bulk_recipients_message ON bulk_recipients(message_id) WHERE message_id IS NOT NULL;

-- ============================================================================
-- DELIVERY STATUS EVENTS: Webhook event tracking
-- ============================================================================
CREATE TABLE delivery_status_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_events_message ON delivery_status_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_delivery_events_external ON delivery_status_events(external_id);
CREATE INDEX idx_delivery_events_processed ON delivery_status_events(processed, created_at) WHERE NOT processed;

-- ============================================================================
-- AUDIT LOG: Append-only audit trail
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  scope TEXT NOT NULL CHECK (scope IN ('tenant', 'group', 'gateway', 'system')),
  scope_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON audit_log(action_type, created_at DESC);

-- Prevent UPDATE/DELETE on audit_log
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ============================================================================
-- IMPORT JOBS: Batch data imports
-- ============================================================================
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('contacts', 'messages', 'bulk_recipients')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_path TEXT,
  total_rows INTEGER,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id, created_at DESC);
CREATE INDEX idx_import_jobs_status ON import_jobs(status) WHERE status IN ('pending', 'processing');

-- ============================================================================
-- SIMULATION SCENARIOS: Testing/training scenarios
-- ============================================================================
CREATE TABLE simulation_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_simulation_scenarios_tenant ON simulation_scenarios(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_simulation_scenarios_active ON simulation_scenarios(tenant_id, is_active) WHERE deleted_at IS NULL;

-- ============================================================================
-- SIMULATION EVENTS: Simulated message events
-- ============================================================================
CREATE TABLE simulation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  content TEXT,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_simulation_events_scenario ON simulation_events(scenario_id, delay_seconds);

-- ============================================================================
-- ESCALATION EVENTS: Track escalation history
-- ============================================================================
CREATE TABLE escalation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,
  escalated_to_user_ids UUID[],
  escalated_to_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escalation_events_message ON escalation_events(message_id, created_at DESC);
CREATE INDEX idx_escalation_events_group ON escalation_events(escalated_to_group_id, created_at DESC) WHERE escalated_to_group_id IS NOT NULL;

-- ============================================================================
-- NOTIFICATION PREFERENCES: User notification settings
-- ============================================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'push', 'sms', 'in_app')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, group_id, notification_type)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_prefs_group ON notification_preferences(group_id) WHERE group_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS: Updated_at automation
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_group_memberships_updated_at BEFORE UPDATE ON group_memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_on_duty_state_updated_at BEFORE UPDATE ON on_duty_state FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contact_phones_updated_at BEFORE UPDATE ON contact_phones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_group_contacts_updated_at BEFORE UPDATE ON group_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_whitelisted_numbers_updated_at BEFORE UPDATE ON whitelisted_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_gateways_updated_at BEFORE UPDATE ON gateways FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_gateway_fallback_inboxes_updated_at BEFORE UPDATE ON gateway_fallback_inboxes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_message_threads_updated_at BEFORE UPDATE ON message_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_routing_rules_updated_at BEFORE UPDATE ON routing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_auto_replies_updated_at BEFORE UPDATE ON auto_replies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_opening_hours_updated_at BEFORE UPDATE ON opening_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_opening_hour_exceptions_updated_at BEFORE UPDATE ON opening_hour_exceptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_bulk_campaigns_updated_at BEFORE UPDATE ON bulk_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_bulk_recipients_updated_at BEFORE UPDATE ON bulk_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON import_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_simulation_scenarios_updated_at BEFORE UPDATE ON simulation_scenarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();