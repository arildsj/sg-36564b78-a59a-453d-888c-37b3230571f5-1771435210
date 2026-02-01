-- Step 1: Activate the Fair Gateway
UPDATE gateways 
SET status = 'active' 
WHERE id = 'c38bee1f-a45f-4a86-b1ae-35dbba4757ef';

-- Step 2: Add gateway_id column to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL;

-- Step 3: Link all groups to Fair Gateway
UPDATE groups 
SET gateway_id = 'c38bee1f-a45f-4a86-b1ae-35dbba4757ef';

-- Step 4: Verify the changes
SELECT 
  g.id, 
  g.name, 
  g.kind,
  gw.name as gateway_name,
  gw.phone_number as gateway_phone
FROM groups g
LEFT JOIN gateways gw ON g.gateway_id = gw.id
ORDER BY g.name;