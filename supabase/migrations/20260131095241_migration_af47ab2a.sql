-- Create contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add constraints
  CONSTRAINT contacts_tenant_id_phone_number_key UNIQUE (tenant_id, phone_number),
  CONSTRAINT contacts_tenant_id_external_id_key UNIQUE (tenant_id, external_id)
);

-- Enable RLS for contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can view contacts in their tenant" ON contacts
  FOR SELECT USING (tenant_id = user_tenant_id());

CREATE POLICY "Users can insert contacts in their tenant" ON contacts
  FOR INSERT WITH CHECK (tenant_id = user_tenant_id());

CREATE POLICY "Users can update contacts in their tenant" ON contacts
  FOR UPDATE USING (tenant_id = user_tenant_id());

CREATE POLICY "Users can delete contacts in their tenant" ON contacts
  FOR DELETE USING (tenant_id = user_tenant_id());

-- Create contact_relationships table
CREATE TABLE contact_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  related_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate relationships
  CONSTRAINT contact_relationships_unique_pair UNIQUE (subject_contact_id, related_contact_id),
  -- Prevent self-reference
  CONSTRAINT contact_relationships_no_self_ref CHECK (subject_contact_id != related_contact_id)
);

-- Enable RLS for relationships
ALTER TABLE contact_relationships ENABLE ROW LEVEL SECURITY;

-- Create policies for relationships
CREATE POLICY "Users can view relationships in their tenant" ON contact_relationships
  FOR SELECT USING (tenant_id = user_tenant_id());

CREATE POLICY "Users can manage relationships in their tenant" ON contact_relationships
  FOR ALL USING (tenant_id = user_tenant_id());

-- Create indexes for performance
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_group ON contacts(group_id);
CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_external ON contacts(external_id);
CREATE INDEX idx_relationships_subject ON contact_relationships(subject_contact_id);
CREATE INDEX idx_relationships_related ON contact_relationships(related_contact_id);