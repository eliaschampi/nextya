with
  policies as (
    select
      pol.polname as policy_name,
      cls.relname as table_name,
      nsp.nspname as schema_name
    from
      pg_policy pol
      join pg_class cls on pol.polrelid = cls.oid
      join pg_namespace nsp on cls.relnamespace = nsp.oid
    where
      nsp.nspname = 'public' -- Focus on your schema (default: public)
  )
select
  'DROP POLICY "' || policy_name || '" ON ' || schema_name || '."' || table_name || '";' as drop_command
from
  policies;
