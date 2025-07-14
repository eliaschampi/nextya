-- =====================================================
-- NextYa Database Schema - Main Initialization File
-- =====================================================
-- This file loads all database components in the correct order
-- Migrated from Supabase to self-hosted PostgreSQL
-- =====================================================

-- Load database components in order
\i /docker-entrypoint-initdb.d/00-config.sql
\i /docker-entrypoint-initdb.d/01-tables.sql
\i /docker-entrypoint-initdb.d/02-constraints-indexes.sql
\i /docker-entrypoint-initdb.d/03-functions.sql
\i /docker-entrypoint-initdb.d/03-functions-dashboard.sql
\i /docker-entrypoint-initdb.d/03-functions-dashboard2.sql
\i /docker-entrypoint-initdb.d/04-views.sql
\i /docker-entrypoint-initdb.d/05-grants.sql
