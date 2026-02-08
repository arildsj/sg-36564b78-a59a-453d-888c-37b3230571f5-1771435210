-- SeMSe + FairGateway: Helper Functions for Business Logic
-- PROMPT 1: Database-level utilities for safe operations

-- ============================================================================
-- GROUP HIERARCHY: Maintain materialized path
-- ============================================================================
CREATE OR REPLACE FUNCTION update_group_path()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_path TEXT[];
  v_parent_depth INTEGER;
BEGIN
  IF NEW.parent_group_id IS NULL THEN
    -- Root group
    NEW.path := ARRAY[NEW.id::TEXT];
    NEW.depth := 0;
  ELSE
    -- Get parent's path and depth
    SELECT path, depth 
    INTO v_parent_path, v_parent_depth
    FROM groups 
    WHERE id = NEW.parent_group_id;

    IF v_parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent group not found: %', NEW.parent_group_id;
    END IF;

    NEW.path := v_parent_path || NEW.id::TEXT;
    NEW.depth := v_parent_depth + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_group_path
BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION update_group_path();

-- ============================================================================
-- GROUP HIERARCHY: Cascade path updates to descendants
-- ============================================================================
CREATE OR REPLACE FUNCTION cascade_group_path_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if path has changed and it's an update
  IF TG_OP = 'UPDATE' AND OLD.path IS DISTINCT FROM NEW.path THEN
    -- Update all descendants: replace old prefix with new prefix
    UPDATE groups
    SET path = NEW.path || path[array_length(OLD.path, 1) + 1:],
        depth = array_length(NEW.path || path[array_length(OLD.path, 1) + 1:], 1) - 1
    WHERE path @> OLD.path 
      AND id != NEW.id -- Don't update self (already done)
      AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_group_path_cascade
AFTER UPDATE OF path ON groups
FOR EACH ROW EXECUTE FUNCTION cascade_group_path_update();

-- ============================================================================
-- CONTACT MANAGEMENT: Ensure primary phone uniqueness
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_single_primary_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset other primary phones for this contact
    UPDATE contact_phones
    SET is_primary = false
    WHERE contact_id = NEW.contact_id
      AND id != NEW.id
      AND is_primary = true
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_primary_phone
BEFORE INSERT OR UPDATE ON contact_phones
FOR EACH ROW EXECUTE FUNCTION ensure_single_primary_phone();

-- ============================================================================
-- MESSAGE THREADS: Auto-update last_message_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_on_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_thread_timestamp();

-- ============================================================================
-- BULK CAMPAIGNS: Auto-update recipient counts
-- ============================================================================
CREATE OR REPLACE FUNCTION update_campaign_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bulk_campaigns
    SET total_recipients = total_recipients + 1
    WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      UPDATE bulk_campaigns
      SET 
        sent_count = CASE WHEN NEW.status = 'sent' THEN sent_count + 1 ELSE sent_count END,
        failed_count = CASE WHEN NEW.status = 'failed' THEN failed_count + 1 ELSE failed_count END,
        updated_at = NOW()
      WHERE id = NEW.campaign_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_campaign_counts
AFTER INSERT OR UPDATE ON bulk_recipients
FOR EACH ROW EXECUTE FUNCTION update_campaign_counts();

-- ============================================================================
-- UTILITY: Get user's accessible groups (including ancestors)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_accessible_groups(p_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  group_kind TEXT,
  depth INTEGER,
  is_member BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_groups AS (
    SELECT g.id, g.path
    FROM groups g
    INNER JOIN group_memberships gm ON g.id = gm.group_id
    WHERE gm.user_id = p_user_id
      AND gm.deleted_at IS NULL
      AND g.deleted_at IS NULL
  )
  SELECT DISTINCT
    g.id AS group_id,
    g.name AS group_name,
    g.kind AS group_kind,
    g.depth,
    EXISTS(
      SELECT 1 FROM group_memberships gm2
      WHERE gm2.group_id = g.id 
        AND gm2.user_id = p_user_id
        AND gm2.deleted_at IS NULL
    ) AS is_member
  FROM groups g
  INNER JOIN user_groups ug ON g.id = ANY(
    SELECT unnest(path::UUID[]) FROM user_groups
  )
  WHERE g.deleted_at IS NULL
  ORDER BY g.depth, g.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Get on-duty users for a group
-- ============================================================================
CREATE OR REPLACE FUNCTION get_on_duty_users(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.email,
    u.full_name
  FROM user_profiles u
  INNER JOIN on_duty_state od ON u.id = od.user_id
  WHERE od.group_id = p_group_id
    AND od.is_on_duty = true
    AND u.status = 'active'
    AND u.deleted_at IS NULL
  ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Find or create contact by phone number
-- ============================================================================
CREATE OR REPLACE FUNCTION find_or_create_contact(
  p_tenant_id UUID,
  p_phone_number TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
  v_existing_phone_id UUID;
BEGIN
  -- Try to find existing contact by phone
  SELECT c.id INTO v_contact_id
  FROM contacts c
  INNER JOIN contact_phones cp ON c.id = cp.contact_id
  WHERE c.tenant_id = p_tenant_id
    AND cp.phone_number = p_phone_number
    AND c.deleted_at IS NULL
    AND cp.deleted_at IS NULL
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;

  -- Create new contact
  INSERT INTO contacts (tenant_id, first_name, last_name)
  VALUES (p_tenant_id, p_first_name, p_last_name)
  RETURNING id INTO v_contact_id;

  -- Add phone number
  INSERT INTO contact_phones (contact_id, phone_number, is_primary)
  VALUES (v_contact_id, p_phone_number, true);

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Get or create message thread
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_thread(
  p_tenant_id UUID,
  p_group_id UUID,
  p_external_number TEXT,
  p_gateway_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  -- Try to find existing thread
  SELECT id INTO v_thread_id
  FROM message_threads
  WHERE tenant_id = p_tenant_id
    AND group_id = p_group_id
    AND external_number = p_external_number
    AND gateway_id = p_gateway_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_thread_id IS NOT NULL THEN
    RETURN v_thread_id;
  END IF;

  -- Create new thread
  INSERT INTO message_threads (
    tenant_id,
    group_id,
    external_number,
    gateway_id
  ) VALUES (
    p_tenant_id,
    p_group_id,
    p_external_number,
    p_gateway_id
  ) RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Soft delete with cascade awareness
-- ============================================================================
CREATE OR REPLACE FUNCTION soft_delete_entity(
  p_table_name TEXT,
  p_entity_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_sql TEXT;
BEGIN
  -- Validate table name to prevent SQL injection
  IF p_table_name NOT IN (
    'tenants', 'user_profiles', 'groups', 'group_memberships',
    'contacts', 'contact_phones', 'group_contacts', 'whitelisted_numbers',
    'gateways', 'message_threads', 'messages', 'routing_rules',
    'auto_replies', 'opening_hours', 'opening_hour_exceptions',
    'bulk_campaigns', 'simulation_scenarios'
  ) THEN
    RAISE EXCEPTION 'Invalid table name for soft delete: %', p_table_name;
  END IF;

  v_sql := format('UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', p_table_name);
  EXECUTE v_sql USING p_entity_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Check if number is whitelisted for group
-- ============================================================================
CREATE OR REPLACE FUNCTION is_number_whitelisted(
  p_tenant_id UUID,
  p_phone_number TEXT,
  p_group_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM whitelisted_numbers wn
    LEFT JOIN whitelisted_number_group_links wgl ON wn.id = wgl.whitelisted_number_id
    WHERE wn.tenant_id = p_tenant_id
      AND wn.phone_number = p_phone_number
      AND wn.deleted_at IS NULL
      AND (p_group_id IS NULL OR wgl.group_id = p_group_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY: Validate E.164 phone format
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_e164_phone(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- E.164 format: +[country code][number], 7-15 digits total
  RETURN p_phone ~ '^\+[1-9]\d{6,14}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint to enforce E.164 on relevant tables
ALTER TABLE contact_phones 
  ADD CONSTRAINT contact_phones_e164_check 
  CHECK (validate_e164_phone(phone_number));

ALTER TABLE whitelisted_numbers 
  ADD CONSTRAINT whitelisted_numbers_e164_check 
  CHECK (validate_e164_phone(phone_number));

ALTER TABLE gateways 
  ADD CONSTRAINT gateways_e164_check 
  CHECK (validate_e164_phone(phone_number));

-- ============================================================================
-- ENFORCEMENT: Only operational groups can have messages (F003)
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_operational_group_messages()
RETURNS TRIGGER AS $$
DECLARE
  v_group_kind TEXT;
BEGIN
  SELECT kind INTO v_group_kind
  FROM groups
  WHERE id = NEW.resolved_group_id;

  IF v_group_kind != 'operational' THEN
    RAISE EXCEPTION 'Messages can only be assigned to operational groups (id: %)', NEW.resolved_group_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_message_group_kind
BEFORE INSERT OR UPDATE OF resolved_group_id ON messages
FOR EACH ROW EXECUTE FUNCTION enforce_operational_group_messages();

-- ============================================================================
-- ENFORCEMENT: Minimum on-duty count (F007)
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_min_on_duty_count()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_min_count INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Determine group_id based on operation
  IF TG_OP = 'DELETE' THEN
    v_group_id := OLD.group_id;
    -- Only check if the deleted user was on duty
    IF OLD.is_on_duty = false THEN RETURN OLD; END IF;
  ELSE
    v_group_id := NEW.group_id;
    -- Only check if toggling OFF
    IF NEW.is_on_duty = true THEN RETURN NEW; END IF;
    -- If was already off, no change
    IF TG_OP = 'UPDATE' AND OLD.is_on_duty = false THEN RETURN NEW; END IF;
  END IF;

  -- Get group requirement
  SELECT min_on_duty_count INTO v_min_count
  FROM groups
  WHERE id = v_group_id;

  -- Count CURRENT on-duty users (excluding the one being changed effectively)
  -- Note: MVCC means we see the current state.
  -- If TG_OP is DELETE, the row is about to go. 
  -- If UPDATE, it's about to turn false.
  -- So we count all currently true, and if that count <= min, we block.
  
  SELECT COUNT(*) INTO v_current_count
  FROM on_duty_state
  WHERE group_id = v_group_id 
    AND is_on_duty = true
    AND user_id != COALESCE(OLD.user_id, NEW.user_id); -- Exclude self from "remaining" count

  IF v_current_count < v_min_count THEN
    RAISE EXCEPTION 'Cannot go off-duty: Group requires minimum % on-duty users. Currently active: %', v_min_count, v_current_count + 1;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_min_on_duty
BEFORE DELETE OR UPDATE OF is_on_duty ON on_duty_state
FOR EACH ROW EXECUTE FUNCTION enforce_min_on_duty_count();

-- ============================================================================
-- COMPLIANCE: Hard delete tenant data (GDPR Right to Erasure) (F006)
-- ============================================================================
CREATE OR REPLACE FUNCTION hard_delete_tenant_data(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Tables with CASCADE will be handled automatically by tenant deletion
  -- This function is for explicit, irreversible purging
  
  -- 1. Log the purge action (if audit log survives)
  INSERT INTO audit_log (tenant_id, action_type, entity_type, scope, metadata)
  VALUES (p_tenant_id, 'hard_delete', 'tenant', 'system', '{"reason": "GDPR Right to Erasure"}');

  -- 2. Delete the tenant (cascades to all other tables)
  DELETE FROM tenants WHERE id = p_tenant_id;
  
  -- Note: Storage files must be deleted separately via storage service
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLIANCE: GDPR Data Export (DSAR) (F013)
-- ============================================================================
CREATE OR REPLACE FUNCTION export_contact_data(p_phone_number TEXT)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user's tenant context
  v_tenant_id := auth.user_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: No tenant context';
  END IF;

  SELECT jsonb_build_object(
    'contact', (
      SELECT row_to_json(c) 
      FROM contacts c
      JOIN contact_phones cp ON c.id = cp.contact_id
      WHERE c.tenant_id = v_tenant_id 
      AND cp.phone_number = p_phone_number
      LIMIT 1
    ),
    'messages', (
      SELECT json_agg(row_to_json(m))
      FROM messages m
      WHERE m.tenant_id = v_tenant_id
      AND (m.from_number = p_phone_number OR m.to_number = p_phone_number)
    ),
    'generated_at', NOW()
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_accessible_groups TO authenticated;
GRANT EXECUTE ON FUNCTION get_on_duty_users TO authenticated;
GRANT EXECUTE ON FUNCTION find_or_create_contact TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_thread TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_entity TO authenticated;
GRANT EXECUTE ON FUNCTION is_number_whitelisted TO authenticated;
GRANT EXECUTE ON FUNCTION validate_e164_phone TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_tenant_data TO authenticated;
GRANT EXECUTE ON FUNCTION export_contact_data TO authenticated;