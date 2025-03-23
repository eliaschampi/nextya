-- SELECT policy (unchanged)
create policy "Users_can_view_students" on students for
select
    using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_student" on students FOR
INSERT
    WITH CHECK (public.has_permission ('students', 'create'));

-- UPDATE policy (optimized)
create policy "users_can_update_student" on students FOR
UPDATE
    USING (
        user_code = (
            select
                auth.uid()
        )
        OR public.has_permission ('students', 'update')
    );

-- DELETE policy (optimized)
create policy "users_can_del_student" on students FOR DELETE USING (public.has_permission ('students', 'delete'));