-- SeMSe + FairGateway: Audit Log Functions
-- PROMPT 1: Secure append-only audit logging

-- ============================================================================
-- AUDIT LOG INSERTION FUNCTION (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id UUID,
  p_actor_user_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_scope TEXT,
  p_scope_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  -- Validate scope
  IF p_scope NOT IN ('tenant', 'group', 'gateway', 'system') THEN
    RAISE EXCEPTION 'Invalid audit scope: %', p_scope;
  END IF;

  -- Insert audit record
  INSERT INTO audit_log (
    tenant_id,
    actor_user_id,
    action_type,
    entity_type,
    entity_id,
    scope,
    scope_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_actor_user_id,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_scope,
    p_scope_id,
    p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUTOMATIC AUDIT TRIGGERS FOR CRITICAL OPERATIONS
-- ============================================================================

-- Audit function for user profile changes
CREATE OR REPLACE FUNCTION audit_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      auth.uid(),
      'user_profile_created',
      'user_profile',
      NEW.id,
      'tenant',
      NEW.tenant_id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if meaningful fields changed
    IF (OLD.role IS DISTINCT FROM NEW.role) OR 
       (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'user_profile_updated',
        'user_profile',
        NEW.id,
        'tenant',
        NEW.tenant_id,
        jsonb_build_object(
          'old_role', OLD.role,
          'new_role', NEW.role,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.tenant_id,
      auth.uid(),
      'user_profile_deleted',
      'user_profile',
      OLD.id,
      'tenant',
      OLD.tenant_id,
      jsonb_build_object('email', OLD.email)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_user_profiles
AFTER INSERT OR UPDATE OR DELETE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION audit_user_profile_changes();

-- Audit function for routing rule changes
CREATE OR REPLACE FUNCTION audit_routing_rule_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      auth.uid(),
      'routing_rule_created',
      'routing_rule',
      NEW.id,
      'tenant',
      NEW.tenant_id,
      jsonb_build_object(
        'name', NEW.name,
        'match_type', NEW.match_type,
        'target_group_id', NEW.target_group_id
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.is_active IS DISTINCT FROM NEW.is_active) OR
       (OLD.target_group_id IS DISTINCT FROM NEW.target_group_id) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'routing_rule_updated',
        'routing_rule',
        NEW.id,
        'tenant',
        NEW.tenant_id,
        jsonb_build_object(
          'old_active', OLD.is_active,
          'new_active', NEW.is_active,
          'old_target', OLD.target_group_id,
          'new_target', NEW.target_group_id
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.tenant_id,
      auth.uid(),
      'routing_rule_deleted',
      'routing_rule',
      OLD.id,
      'tenant',
      OLD.tenant_id,
      jsonb_build_object('name', OLD.name)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_routing_rules
AFTER INSERT OR UPDATE OR DELETE ON routing_rules
FOR EACH ROW EXECUTE FUNCTION audit_routing_rule_changes();

-- Audit function for gateway changes
CREATE OR REPLACE FUNCTION audit_gateway_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      auth.uid(),
      'gateway_created',
      'gateway',
      NEW.id,
      'gateway',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'phone_number', NEW.phone_number)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'gateway_status_changed',
        'gateway',
        NEW.id,
        'gateway',
        NEW.id,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.tenant_id,
      auth.uid(),
      'gateway_deleted',
      'gateway',
      OLD.id,
      'gateway',
      OLD.id,
      jsonb_build_object('name', OLD.name)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_gateways
AFTER INSERT OR UPDATE OR DELETE ON gateways
FOR EACH ROW EXECUTE FUNCTION audit_gateway_changes();

-- Audit function for group changes
CREATE OR REPLACE FUNCTION audit_group_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      auth.uid(),
      'group_created',
      'group',
      NEW.id,
      'group',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'kind', NEW.kind)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.name IS DISTINCT FROM NEW.name) OR
       (OLD.parent_group_id IS DISTINCT FROM NEW.parent_group_id) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'group_updated',
        'group',
        NEW.id,
        'group',
        NEW.id,
        jsonb_build_object(
          'old_name', OLD.name,
          'new_name', NEW.name,
          'old_parent', OLD.parent_group_id,
          'new_parent', NEW.parent_group_id
        )
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.tenant_id,
      auth.uid(),
      'group_deleted',
      'group',
      OLD.id,
      'group',
      OLD.id,
      jsonb_build_object('name', OLD.name)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_groups
AFTER INSERT OR UPDATE OR DELETE ON groups
FOR EACH ROW EXECUTE FUNCTION audit_group_changes();

-- Audit function for message sending
CREATE OR REPLACE FUNCTION audit_message_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.direction = 'outbound' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      NEW.sent_by_user_id,
      'message_sent',
      'message',
      NEW.id,
      'group',
      NEW.resolved_group_id,
      jsonb_build_object(
        'to_number', NEW.to_number,
        'gateway_id', NEW.gateway_id,
        'has_mms', (NEW.mms_media_urls IS NOT NULL AND array_length(NEW.mms_media_urls, 1) > 0)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_messages_sent
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION audit_message_sent();

-- Audit function for auto-reply triggers
CREATE OR REPLACE FUNCTION audit_auto_reply_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      auth.uid(),
      'auto_reply_created',
      'auto_reply',
      NEW.id,
      CASE WHEN NEW.group_id IS NOT NULL THEN 'group' ELSE 'tenant' END,
      COALESCE(NEW.group_id, NEW.tenant_id),
      jsonb_build_object('trigger_type', NEW.trigger_type)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'auto_reply_toggled',
        'auto_reply',
        NEW.id,
        CASE WHEN NEW.group_id IS NOT NULL THEN 'group' ELSE 'tenant' END,
        COALESCE(NEW.group_id, NEW.tenant_id),
        jsonb_build_object('is_active', NEW.is_active)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      OLD.tenant_id,
      auth.uid(),
      'auto_reply_deleted',
      'auto_reply',
      OLD.id,
      CASE WHEN OLD.group_id IS NOT NULL THEN 'group' ELSE 'tenant' END,
      COALESCE(OLD.group_id, OLD.tenant_id),
      jsonb_build_object('trigger_type', OLD.trigger_type)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_auto_replies
AFTER INSERT OR UPDATE OR DELETE ON auto_replies
FOR EACH ROW EXECUTE FUNCTION audit_auto_reply_changes();

-- Audit function for bulk campaigns
CREATE OR REPLACE FUNCTION audit_bulk_campaign_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      NEW.tenant_id,
      NEW.created_by_user_id,
      'bulk_campaign_created',
      'bulk_campaign',
      NEW.id,
      'group',
      NEW.group_id,
      jsonb_build_object('name', NEW.name, 'total_recipients', NEW.total_recipients)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM log_audit_event(
        NEW.tenant_id,
        auth.uid(),
        'bulk_campaign_status_changed',
        'bulk_campaign',
        NEW.id,
        'group',
        NEW.group_id,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'sent_count', NEW.sent_count,
          'failed_count', NEW.failed_count
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_bulk_campaigns
AFTER INSERT OR UPDATE ON bulk_campaigns
FOR EACH ROW EXECUTE FUNCTION audit_bulk_campaign_changes();

-- ============================================================================
-- HELPER FUNCTION: Get recent audit events for entity
-- ============================================================================
CREATE OR REPLACE FUNCTION get_entity_audit_trail(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  actor_user_id UUID,
  actor_email TEXT,
  action_type TEXT,
  scope TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.actor_user_id,
    u.email AS actor_email,
    a.action_type,
    a.scope,
    a.metadata,
    a.created_at
  FROM audit_log a
  LEFT JOIN user_profiles u ON a.actor_user_id = u.id
  WHERE a.entity_type = p_entity_type
    AND a.entity_id = p_entity_id
    AND a.tenant_id = auth.user_tenant_id()
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_audit_trail TO authenticated;