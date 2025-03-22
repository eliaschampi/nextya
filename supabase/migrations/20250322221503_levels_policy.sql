-- SELECT policy (unchanged)
create policy "Users_can_view_levels" on levels
for select
to authenticated
using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_level" on levels
for insert
to authenticated
with check (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'levels'
      and can_create = true
  )
);

-- UPDATE policy (optimized)
create policy "users_can_update_level" on levels
for update
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'levels'
      and can_update = true
  )
);

-- DELETE policy (optimized)
create policy "users_can_del_level" on levels
for delete
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'levels'
      and can_delete = true
  )
);
