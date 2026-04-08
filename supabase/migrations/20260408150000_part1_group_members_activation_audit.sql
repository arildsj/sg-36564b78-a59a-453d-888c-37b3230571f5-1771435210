-- Part 1: Group members, activation requests, escalation levels, audit log extensions
-- Schema diff vs live DB:
--   groups           → ADD is_fallback, min_active
--   audit_log        → ADD event_type, group_id, target_user_id, metadata
--   NEW: group_members, escalation_levels, activation_requests

-- ─── groups: add min_active and is_fallback ──────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS min_active  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false;

-- ─── group_members ───────────────────────────────────────────────────────
-- Tracks on-duty status per user per group.
-- Separate from group_memberships (which tracks admin role only).
CREATE TABLE IF NOT EXISTS group_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid        NOT NULL REFERENCES groups(id)      ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  is_active boolean     NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Members of the group (via group_memberships) can read
CREATE POLICY "group_members_read" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
    )
  );

-- Group admins and tenant admins can write
CREATE POLICY "group_members_admin_write" ON group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
        AND gm.is_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id   = auth.uid()
        AND role = 'tenant_admin'
    )
  );

CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members (group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx  ON group_members (user_id);

-- ─── escalation_levels ───────────────────────────────────────────────────
-- Normalized escalation config per routing rule (replaces the escalation_config JSONB).
CREATE TABLE IF NOT EXISTS escalation_levels (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  routing_rule_id       uuid    NOT NULL REFERENCES routing_rules(id) ON DELETE CASCADE,
  level_number          integer NOT NULL CHECK (level_number BETWEEN 1 AND 10),
  minutes_without_reply integer NOT NULL CHECK (minutes_without_reply > 0),
  notify_group_id       uuid    NOT NULL REFERENCES groups(id),
  methods               text[]  NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routing_rule_id, level_number)
);

ALTER TABLE escalation_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_levels_read" ON escalation_levels
  FOR SELECT USING (true);

CREATE POLICY "escalation_levels_admin_write" ON escalation_levels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id   = auth.uid()
        AND role IN ('tenant_admin', 'group_admin')
    )
  );

-- ─── activation_requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activation_requests (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           uuid    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  requester_id       uuid    NOT NULL REFERENCES auth.users(id),
  requested_user_ids uuid[]  NOT NULL DEFAULT '{}',
  message            text,
  status             text    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  resolved_by        uuid    REFERENCES auth.users(id),
  tenant_id          uuid    NOT NULL
);

ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;

-- Requester and invited users can read their own requests
CREATE POLICY "activation_requests_read" ON activation_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR auth.uid() = ANY(requested_user_ids)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id   = auth.uid()
        AND role IN ('tenant_admin', 'group_admin')
    )
  );

CREATE POLICY "activation_requests_insert" ON activation_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

-- Only invited users and admins can update status
CREATE POLICY "activation_requests_update" ON activation_requests
  FOR UPDATE USING (
    auth.uid() = ANY(requested_user_ids)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id   = auth.uid()
        AND role IN ('tenant_admin', 'group_admin')
    )
  );

CREATE INDEX IF NOT EXISTS activation_requests_status_idx
  ON activation_requests (status, created_at);

CREATE INDEX IF NOT EXISTS activation_requests_requester_idx
  ON activation_requests (requester_id);

-- ─── audit_log: extend with new event columns ────────────────────────────
-- Existing columns: id, user_id, action, resource_type, resource_id,
--   old_data, new_data, ip_address, user_agent, created_at, tenant_id
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS event_type     text,
  ADD COLUMN IF NOT EXISTS group_id       uuid,
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS metadata       jsonb;

-- Valid event_type values (used in code, not enforced by constraint to allow forward compat):
-- activated, deactivated, activation_requested, activation_confirmed,
-- activation_rejected, activation_expired, admin_override,
-- min_active_changed, rule_changed, rule_matched

CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log (event_type);
CREATE INDEX IF NOT EXISTS audit_log_group_id_idx   ON audit_log (group_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON audit_log (user_id);
