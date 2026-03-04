-- ============================================
-- SEMSE 2.0 - KOMPLETT DATABASE SETUP
-- Kjør denne i Supabase SQL Editor
-- ============================================

-- 1. LEGG TIL MANGLENDE KOLONNER I groups TABELL
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS gateway_id UUID REFERENCES sms_gateways(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS escalation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_timeout_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS min_on_duty_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. OPPRETT INDEXES FOR YTELSE
CREATE INDEX IF NOT EXISTS idx_groups_gateway_id ON groups(gateway_id);
CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant_id ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);

-- 3. FJERN GAMLE RLS POLICIES (for å unngå konflikter)
DROP POLICY IF EXISTS "Users can view groups" ON groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Admins can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can update groups" ON groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON groups;

DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can add contacts to their groups" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their groups" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their groups" ON contacts;

-- 4. RLS POLICIES FOR GROUPS

-- 4a. SELECT: Brukere ser grupper de er medlem av + admins ser alt i sin tenant
CREATE POLICY "Users can view their groups"
ON groups
FOR SELECT
USING (
  -- Vanlige medlemmer ser grupper de er medlem av
  EXISTS (
    SELECT 1 
    FROM group_memberships 
    WHERE group_memberships.group_id = groups.id 
    AND group_memberships.user_id = auth.uid()
  )
  OR
  -- Admins (tenant_admin eller group_admin) ser alt i sin tenant
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('tenant_admin', 'group_admin')
    AND user_profiles.tenant_id = groups.tenant_id
  )
);

-- 4b. INSERT: Kun admins kan opprette grupper
CREATE POLICY "Admins can create groups"
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

-- 4c. UPDATE: Kun admins kan oppdatere grupper
CREATE POLICY "Admins can update groups"
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

-- 4d. DELETE: Kun admins kan slette grupper
CREATE POLICY "Admins can delete groups"
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

-- 5. RLS POLICIES FOR CONTACTS (GDPR-ISOLERT PER GRUPPE)

-- 5a. SELECT: Kun kontakter i egne grupper (INGEN arv fra forelder)
CREATE POLICY "Users can view contacts in their groups"
ON contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_memberships.group_id = contacts.group_id
    AND group_memberships.user_id = auth.uid()
  )
);

-- 5b. INSERT: Kun i egne grupper
CREATE POLICY "Users can add contacts to their groups"
ON contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_memberships.group_id = contacts.group_id
    AND group_memberships.user_id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.tenant_id = contacts.tenant_id
  )
);

-- 5c. UPDATE: Kun egne grupper
CREATE POLICY "Users can update contacts in their groups"
ON contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_memberships.group_id = contacts.group_id
    AND group_memberships.user_id = auth.uid()
  )
);

-- 5d. DELETE: Kun egne grupper
CREATE POLICY "Users can delete contacts in their groups"
ON contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM group_memberships
    WHERE group_memberships.group_id = contacts.group_id
    AND group_memberships.user_id = auth.uid()
  )
);

-- 6. VERIFISER AT RLS ER AKTIVERT
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FERDIG! 🎉
-- ============================================