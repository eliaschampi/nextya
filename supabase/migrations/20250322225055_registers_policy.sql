-- SELECT policy (unchanged)
create policy "Users_can_view_registers" on registers
for select
to authenticated
using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_register" on registers
for insert
to authenticated
with check (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'registers'
      and can_create = true
  )
);

-- UPDATE policy (optimized)
create policy "users_can_update_register" on registers
for update
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'registers'
      and can_update = true
  )
);

-- DELETE policy (optimized)
create policy "users_can_del_register" on registers
for delete
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'registers'
      and can_delete = true
  )
);