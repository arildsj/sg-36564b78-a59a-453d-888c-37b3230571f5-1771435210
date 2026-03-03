-- ============================================
-- FIX RLS RECURSION PROBLEM
-- Reverserer til enklere policies uten sirkulære avhengigheter
-- ============================================

-- PROBLEM: Migration fed4c971 skapte sirkulær avhengighet:
-- groups policy → group_memberships policy → groups policy → ∞
-- LØSNING: Fjern all referanse til groups fra group_memberships policy

-- ============================================
-- 1. FIX GROUP_MEMBERSHIPS POLICIES
-- ============================================

-- Fjern gamle policies
DROP POLICY IF EXISTS "View memberships" ON group_memberships;
DROP POLICY IF EXISTS "Admins can add members" ON group_memberships;
DROP POLICY IF EXISTS "Admins can remove members" ON group_memberships;
DROP POLICY IF EXISTS "Authenticated users can insert memberships" ON group_memberships;

-- SELECT: Enkel policy uten referanse til groups
CREATE POLICY "Users view own memberships"
ON group_memberships
FOR SELECT
USING (
  -- Brukere ser kun sine egne memberships
  user_id = auth.uid()
);

-- INSERT: Tillat authenticated og service_role (for onboarding)
CREATE POLICY "Authenticated users can insert memberships"
ON group_memberships
FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- UPDATE: Ikke nødvendig (memberships endres sjelden)

-- DELETE: Kun service_role og admins
CREATE POLICY "Service role can delete memberships"
ON group_memberships
FOR DELETE
TO service_role
USING (true);

-- ============================================
-- 2. FIX GROUPS POLICIES (fjern sirkulære refs)
-- ============================================

-- Fjern gamle policies
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Admins can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can update groups" ON groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON groups;
DROP POLICY IF EXISTS "groups_select_policy" ON groups;

-- SELECT: Brukere ser grupper de er medlem av (ingen recursion)
CREATE POLICY "Users view their groups"
ON groups
FOR SELECT
USING (
  -- Brukere ser grupper de er direkte medlem av
  id IN (
    SELECT group_id 
    FROM group_memberships 
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Kun admins kan opprette grupper
CREATE POLICY "Admins create groups"
ON groups
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- UPDATE: Kun admins kan oppdatere grupper i sin tenant
CREATE POLICY "Admins update groups"
ON groups
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- DELETE: Kun admins kan slette grupper i sin tenant
CREATE POLICY "Admins delete groups"
ON groups
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- ============================================
-- 3. BEHOLD CONTACTS POLICIES (fungerer bra)
-- ============================================

-- Contacts policies trenger ikke endring (bruker group_memberships riktig)

-- ============================================
-- 4. VERIFISER RLS ER AKTIVERT
-- ============================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FERDIG! 🎉
-- ============================================

-- VIKTIG MERK:
-- - Admins må legges til som medlemmer i grupper via group_memberships
-- - Dette sikrer at de får tilgang via samme mekanisme som vanlige brukere
-- - Ingen sirkulære avhengigheter = ingen recursion