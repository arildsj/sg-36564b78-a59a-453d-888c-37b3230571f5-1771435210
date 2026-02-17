-- Add on_duty column to users table
ALTER TABLE users 
ADD COLUMN on_duty BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN users.on_duty IS 'Indicates if user is currently on duty/on call';