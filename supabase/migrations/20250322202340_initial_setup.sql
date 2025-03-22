-- role
create role admin;

-- tables
create table public.profiles (
  code uuid not null references auth.users (id) on delete CASCADE,
  name varchar(50),
  last_name varchar(100),
  photo_url varchar(100),
  is_active boolean not null default true,
  constraint pk_profile primary key (code)
);

alter table public.profiles ENABLE row LEVEL SECURITY;

-- very important for user management
create table public.permissions (
  code uuid not null default gen_random_uuid (),
  user_code uuid not null references auth.users (id) on delete CASCADE,
  entity varchar(100) not null, -- tables name
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  constraint pk_permission primary key (code)
);

alter table public.permissions ENABLE row LEVEL SECURITY;

-- view 1: user_profile
create view public.user_profiles
WITH (security_barrier) AS
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

-- POLICY 1: Allows all authenticated users to select from profiles
create policy "select_profiles_all" on profiles for
select
  to authenticated using (true);

-- POLICY 2: Allows insert into profiles only if user is admin
create policy "insert_profiles_admin" on public.profiles for insert to authenticated
with
  check (
    (
      select
        current_setting('request.jwt.claims.role', true)
    ) = 'admin'
  );

-- POLICY 3: Allows updates to profiles if user is owner or admin
create policy "update_profiles_owner" on public.profiles
for update
  to authenticated using (
    code = (
      select
        auth.uid ()
    )
    or (
      select
        current_setting('request.jwt.claims.role', true)
    ) = 'admin'
  );

-- POLICY 4: Allows deletion of profiles only if user is admin
create policy "delete_profiles_admin" on public.profiles for delete to authenticated using (
  (
    select
      current_setting('request.jwt.claims.role', true)
  ) = 'admin'
);

-- POLICY 5: Allows select on permissions if user is owner or admin
create policy "select_permissions" on public.permissions for
select
  to authenticated using (
    user_code = (
      select
        auth.uid ()
    )
    or (
      select
        current_setting('request.jwt.claims.role', true)
    ) = 'admin'
  );

-- POLICY 6: Allows insertion into permissions only if user is admin
create policy "insert_permissions_admin" on public.permissions for insert to authenticated
with
  check (
    (
      select
        current_setting('request.jwt.claims.role', true)
    ) = 'admin'
  );

-- POLICY 7: Allows updates to permissions only if user is admin
create policy "update_permissions_admin" on public.permissions
for update
  to authenticated using (
    (
      select
        current_setting('request.jwt.claims.role', true)
    ) = 'admin'
  );

-- POLICY 8: Allows deletion of permissions only if user is admin
create policy "delete_permissions_admin" on public.permissions for delete to authenticated using (
  (
    select
      current_setting('request.jwt.claims.role', true)
  ) = 'admin'
);

-- Index for permissions
create index idx_permissions_user_entity on permissions (user_code, entity);