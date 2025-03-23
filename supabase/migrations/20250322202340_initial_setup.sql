-- tables
create table public.profiles (
  code uuid not null references auth.users (id) on delete CASCADE,
  name varchar(50),
  last_name varchar(100),
  photo_url varchar(100),
  is_active boolean not null default true,
  constraint pk_profile primary key (code)
);

alter table
  public.profiles ENABLE row LEVEL SECURITY;

-- very important for user management
create table public.permissions (
  code uuid not null default gen_random_uuid (),
  user_code uuid not null references auth.users (id) on delete CASCADE,
  entity varchar(100) not null,
  -- tables name
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  constraint pk_permission primary key (code)
);

alter table
  public.permissions ENABLE row LEVEL SECURITY;

-- view 1: user_profile
create view public.user_profiles WITH (security_invoker = true) AS
select
  u.id as user_id,
  u.role,
  u.email,
  u.phone,
  u.created_at,
  u.last_sign_in_at,
  p.name,
  p.last_name,
  p.photo_url,
  p.is_active
from
  auth.users u
  join public.profiles p on p.code = u.id;

-- Index for permissions
create index idx_permissions_user_entity on permissions (user_code, entity);

CREATE INDEX idx_profiles_user_id ON public.profiles(code);

-- policies
CREATE
OR REPLACE FUNCTION public.is_super_admin() RETURNS BOOLEAN AS $$ 
BEGIN RETURN 
current_setting('request.jwt.claims.email', true) 
IN ('elias@nextya.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar permisos
CREATE
OR REPLACE FUNCTION public.has_permission(entity_name text, permission text) RETURNS BOOLEAN AS $$ BEGIN -- Super admins siempre tienen todos los permisos
IF public.is_super_admin() THEN RETURN TRUE;

END IF;

-- Comprobar permiso específico
RETURN EXISTS (
  SELECT
    1
  FROM
    permissions
  WHERE
    user_code = (
      SELECT
        auth.uid()
    )
    AND entity = entity_name
    AND (
      (
        permission = 'create'
        AND can_create = true
      )
      OR (
        permission = 'update'
        AND can_update = true
      )
      OR (
        permission = 'delete'
        AND can_delete = true
      )
    )
);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para permissions
CREATE POLICY "select_permissions" ON public.permissions FOR
SELECT
  USING (
    user_code = (
      SELECT
        auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE POLICY "insert_permissions" ON public.permissions FOR
INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "update_permissions" ON public.permissions FOR
UPDATE
  USING (public.is_super_admin());

CREATE POLICY "delete_permissions" ON public.permissions FOR DELETE USING (public.is_super_admin());

-- Políticas para profiles
CREATE POLICY "select_profiles_all" ON profiles FOR
SELECT
  USING (true);

CREATE POLICY "insert_profiles" ON public.profiles FOR
INSERT
  WITH CHECK (public.has_permission('profiles', 'create'));

CREATE POLICY "update_profiles" ON public.profiles FOR
UPDATE
  USING (
    code = (
      SELECT
        auth.uid()
    )
    OR public.has_permission('profiles', 'update')
  );

CREATE POLICY "delete_profiles" ON public.profiles FOR DELETE USING (public.has_permission('profiles', 'delete'));