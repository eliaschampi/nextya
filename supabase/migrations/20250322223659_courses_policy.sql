-- SELECT policy (unchanged)
create policy "Users_can_view_courses" on courses
for select
to authenticated
using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_course" on courses
for insert
to authenticated
with check (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'courses'
      and can_create = true
  )
);

-- UPDATE policy (optimized)
create policy "users_can_update_course" on courses
for update
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'courses'
      and can_update = true
  )
);

-- DELETE policy (optimized)
create policy "users_can_del_course" on courses
for delete
to authenticated
using (
  exists (
    select 1
    from permissions
    where user_code = (select auth.uid())
      and entity = 'courses'
      and can_delete = true
  )
);