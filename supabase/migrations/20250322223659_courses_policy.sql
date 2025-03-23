-- SELECT policy (unchanged)
create policy "Users_can_view_courses" on courses for
select
    using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_course" on courses FOR
INSERT
    WITH CHECK (public.has_permission ('courses', 'create'));

-- UPDATE policy (optimized)
create policy "users_can_update_course" on courses FOR
UPDATE
    USING (
        user_code = (
            select
                auth.uid ()
        )
        OR public.has_permission ('courses', 'update')
    );

-- DELETE policy (optimized)
create policy "users_can_del_course" on courses FOR DELETE USING (public.has_permission ('courses', 'delete'));