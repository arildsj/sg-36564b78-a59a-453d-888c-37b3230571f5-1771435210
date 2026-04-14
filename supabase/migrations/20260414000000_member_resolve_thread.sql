-- Allow group members to resolve threads assigned to their group.
-- Previously only tenant_admin and group_admin could UPDATE message_threads.
DROP POLICY IF EXISTS message_threads_update ON message_threads;
CREATE POLICY message_threads_update ON message_threads
  FOR UPDATE USING (
    (is_tenant_admin() AND tenant_id = get_user_tenant_id())
    OR is_group_admin_for(resolved_group_id)
    OR is_group_member(resolved_group_id)
  );
