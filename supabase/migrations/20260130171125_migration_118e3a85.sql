-- Add parent_id to groups table for hierarchical structure

ALTER TABLE groups 
ADD COLUMN parent_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Add index for faster hierarchical queries
CREATE INDEX idx_groups_parent_id ON groups(parent_id);

-- Add a check to prevent circular references (a group can't be its own ancestor)
-- This is a simplified check - in production you'd want a more robust solution
ALTER TABLE groups
ADD CONSTRAINT check_not_self_parent CHECK (parent_id IS NULL OR parent_id != id);

-- Add comment to document the hierarchy
COMMENT ON COLUMN groups.parent_id IS 'Parent group ID for hierarchical organization. NULL means root-level group. Both structural and operational groups can have parents.';