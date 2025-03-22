-- SELECT policy (unchanged)
create policy "Users_can_view_students" on students
for select
to authenticated
using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_student" on students
for insert
to authenticated
with check (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'students'
      and can_create = true
  )
);

-- UPDATE policy (optimized)
create policy "users_can_update_student" on students
for update
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'students'
      and can_update = true
  )
);

-- DELETE policy (optimized)
create policy "users_can_del_student" on students
for delete
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'students'
      and can_delete = true
  )
);