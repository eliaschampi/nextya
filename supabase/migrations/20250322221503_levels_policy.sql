-- SELECT policy (unchanged)
create policy "Users_can_view_levels" on levels for
select
    using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_level" on levels FOR
INSERT
    WITH CHECK (public.has_permission ('levels', 'create'));

-- UPDATE policy (optimized)
create policy "users_can_update_level" on levels FOR
UPDATE
    USING (
        user_code = (
            select
                auth.uid()
        )
        OR public.has_permission ('levels', 'update')
    );

-- DELETE policy (optimized)
create policy "users_can_del_level" on levels FOR DELETE USING (public.has_permission ('levels', 'delete'));