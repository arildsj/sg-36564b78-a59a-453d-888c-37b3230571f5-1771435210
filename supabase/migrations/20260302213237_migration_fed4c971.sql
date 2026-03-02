-- 1. Slett eksisterende policy for å starte rent
DROP POLICY IF EXISTS "Users can view their own memberships" ON group_memberships;

-- 2. SELECT: Brukere ser seg selv + Admins ser alt i sin tenant
CREATE POLICY "View memberships"
ON group_memberships
FOR SELECT
USING (
  -- Brukeren ser sine egne memberships
  user_id = auth.uid()
  OR
  -- Admins ser memberships for grupper i sin tenant
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_memberships.group_id
    AND groups.tenant_id = (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')
    )
  )
);

-- 3. INSERT: Kun admins kan legge til medlemmer
CREATE POLICY "Admins can add members"
ON group_memberships
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_memberships.group_id
    AND groups.tenant_id = (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')
    )
  )
);

-- 4. DELETE: Kun admins kan fjerne medlemmer
CREATE POLICY "Admins can remove members"
ON group_memberships
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_memberships.group_id
    AND groups.tenant_id = (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'group_admin')
    )
  )
);