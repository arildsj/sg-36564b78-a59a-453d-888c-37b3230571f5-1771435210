-- ── Fix: members can see all profiles within the same tenant ──────────────────
-- Problem: "user_profiles_select" only covered own profile, tenant_admin,
-- and group_admin. Regular members couldn't read other members' profiles,
-- causing "Ukjent bruker" in vaktliste and inbox.
--
-- Fix: replace the SELECT policy with one that allows any authenticated user
-- to see all profiles in their own tenant. Tenant scoping via the existing
-- SECURITY DEFINER helper get_user_tenant_id() — no recursion risk.
-- INSERT / UPDATE / DELETE policies are unchanged.

DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;

CREATE POLICY "user_profiles_select"
ON user_profiles
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
);
