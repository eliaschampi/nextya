-- =====================================================
-- PERMISSIONS TABLE MIGRATION
-- =====================================================
-- Migrate from old permission structure to new clean structure

-- First, backup existing permissions if any
CREATE TABLE IF NOT EXISTS permissions_backup AS 
SELECT * FROM permissions;

-- Drop the old permissions table
DROP TABLE IF EXISTS permissions;

-- Create the new permissions table with clean structure
CREATE TABLE IF NOT EXISTS permissions (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    entity VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_code, entity, action)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_permissions_user_entity 
ON permissions(user_code, entity);

-- Insert some default permissions for super admin users
INSERT INTO permissions (user_code, entity, action)
SELECT 
    u.code,
    'users',
    'read'
FROM users u 
WHERE u.is_super_admin = true
ON CONFLICT (user_code, entity, action) DO NOTHING;

INSERT INTO permissions (user_code, entity, action)
SELECT 
    u.code,
    'users',
    'create'
FROM users u 
WHERE u.is_super_admin = true
ON CONFLICT (user_code, entity, action) DO NOTHING;

INSERT INTO permissions (user_code, entity, action)
SELECT 
    u.code,
    'users',
    'update'
FROM users u 
WHERE u.is_super_admin = true
ON CONFLICT (user_code, entity, action) DO NOTHING;

INSERT INTO permissions (user_code, entity, action)
SELECT 
    u.code,
    'users',
    'delete'
FROM users u 
WHERE u.is_super_admin = true
ON CONFLICT (user_code, entity, action) DO NOTHING;
