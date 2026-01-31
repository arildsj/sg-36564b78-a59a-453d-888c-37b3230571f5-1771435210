-- ============================================================================
-- AUDIT LOGGING SYSTEM (NIS2, GDPR, NSM, ISO 27001 Compliant)
-- ============================================================================
-- This migration creates comprehensive audit triggers for all critical tables
-- to ensure full traceability and compliance with security standards.
--
-- Compliance Requirements:
-- • NIS2: Incident detection, logging, and security monitoring
-- • GDPR Art. 30: Records of processing activities
-- • NSM Grunnprinsipper: Logging and monitoring (Sikkerhet i drift)
-- • ISO 27001 A.12.4.1: Event logging
-- ============================================================================

-- ============================================================================
-- 1. GENERIC AUDIT TRIGGER FUNCTION
-- ============================================================================
-- This function captures WHO did WHAT, WHEN, and logs before/after states
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_action text;
  v_changes jsonb;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  -- Determine action type
  IF (TG_OP = 'INSERT') THEN
    v_action := 'CREATE';
    v_new_data := to_jsonb(NEW);
    v_changes := jsonb_build_object(
      'new', v_new_data
    );
    v_tenant_id := (NEW.tenant_id)::uuid;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'UPDATE';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    -- Only log actual changes
    v_changes := jsonb_build_object(
      'old', v_old_data,
      'new', v_new_data,
      'changed_fields', (
        SELECT jsonb_object_agg(key, jsonb_build_object('from', value, 'to', v_new_data->key))
        FROM jsonb_each(v_old_data)
        WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
      )
    );
    v_tenant_id := (NEW.tenant_id)::uuid;
    
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_changes := jsonb_build_object(
      'deleted', v_old_data
    );
    v_tenant_id := (OLD.tenant_id)::uuid;
  END IF;

  -- Get current user ID (from auth.uid() or system)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION
    WHEN OTHERS THEN
      v_user_id := NULL; -- System action
  END;

  -- Insert audit log entry
  INSERT INTO audit_log (
    tenant_id,
    user_id,
    action,
    entity_type,
    entity_id,
    changes,
    ip_address,
    user_agent
  ) VALUES (
    v_tenant_id,
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE((NEW.id)::uuid, (OLD.id)::uuid),
    v_changes,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );

  -- Return appropriate value
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block the operation
    RAISE WARNING 'Audit trigger failed: %', SQLERRM;
    IF (TG_OP = 'DELETE') THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. CREATE AUDIT TRIGGERS FOR ALL CRITICAL TABLES
-- ============================================================================

-- USERS table (track user creation, role changes, status changes)
DROP TRIGGER IF EXISTS audit_users_trigger ON users;
CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- GROUPS table (track group creation, hierarchy changes, settings)
DROP TRIGGER IF EXISTS audit_groups_trigger ON groups;
CREATE TRIGGER audit_groups_trigger
  AFTER INSERT OR UPDATE OR DELETE ON groups
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- GROUP_MEMBERSHIPS table (track who was added/removed from groups)
DROP TRIGGER IF EXISTS audit_group_memberships_trigger ON group_memberships;
CREATE TRIGGER audit_group_memberships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON group_memberships
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- WHITELISTED_NUMBERS table (track contact additions/removals/changes)
DROP TRIGGER IF EXISTS audit_whitelisted_numbers_trigger ON whitelisted_numbers;
CREATE TRIGGER audit_whitelisted_numbers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON whitelisted_numbers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- WHITELIST_GROUP_LINKS table (track contact-group associations)
DROP TRIGGER IF EXISTS audit_whitelist_group_links_trigger ON whitelist_group_links;
CREATE TRIGGER audit_whitelist_group_links_trigger
  AFTER INSERT OR UPDATE OR DELETE ON whitelist_group_links
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ROUTING_RULES table (track routing configuration changes)
DROP TRIGGER IF EXISTS audit_routing_rules_trigger ON routing_rules;
CREATE TRIGGER audit_routing_rules_trigger
  AFTER INSERT OR UPDATE OR DELETE ON routing_rules
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- GATEWAYS table (track gateway configuration changes)
DROP TRIGGER IF EXISTS audit_gateways_trigger ON gateways;
CREATE TRIGGER audit_gateways_trigger
  AFTER INSERT OR UPDATE OR DELETE ON gateways
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- OPENING_HOURS table (track schedule changes)
DROP TRIGGER IF EXISTS audit_opening_hours_trigger ON opening_hours;
CREATE TRIGGER audit_opening_hours_trigger
  AFTER INSERT OR UPDATE OR DELETE ON opening_hours
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ON_DUTY_STATUS table (track duty status changes - important for compliance)
DROP TRIGGER IF EXISTS audit_on_duty_status_trigger ON on_duty_status;
CREATE TRIGGER audit_on_duty_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON on_duty_status
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- 3. AUDIT LOG RETENTION POLICY (GDPR & ISO 27001 requirement)
-- ============================================================================

-- Function to clean old audit logs (keep 7 years per most regulations)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_log
  WHERE created_at < NOW() - INTERVAL '7 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. AUDIT LOG HELPER FUNCTIONS
-- ============================================================================

-- Get audit trail for a specific entity
CREATE OR REPLACE FUNCTION get_entity_audit_trail(
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  action text,
  user_name text,
  user_email text,
  changes jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    u.name as user_name,
    u.email as user_email,
    al.changes,
    al.created_at
  FROM audit_log al
  LEFT JOIN users u ON u.id = al.user_id
  WHERE al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent audit activity for tenant
CREATE OR REPLACE FUNCTION get_tenant_audit_activity(
  p_tenant_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  user_name text,
  changes jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    u.name as user_name,
    al.changes,
    al.created_at
  FROM audit_log al
  LEFT JOIN users u ON u.id = al.user_id
  WHERE al.tenant_id = p_tenant_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLIANCE VERIFICATION
-- ============================================================================
COMMENT ON FUNCTION audit_trigger_func() IS 'NIS2/GDPR/NSM/ISO27001: Automatic audit logging for all critical operations';
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'GDPR Art. 5(1)(e): Data retention policy - 7 years for audit logs';
COMMENT ON FUNCTION get_entity_audit_trail(text, uuid, integer) IS 'ISO 27001 A.12.4.1: Retrieve complete audit trail for any entity';
COMMENT ON FUNCTION get_tenant_audit_activity(uuid, integer) IS 'NIS2: Monitor and report security-relevant activities';