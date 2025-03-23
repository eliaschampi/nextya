-- SELECT policy (unchanged)
create policy "Users_can_view_registers" on registers for
select
    using (true);

-- INSERT policy (optimized)
create policy "users_can_insert_register" on registers FOR
INSERT
    WITH CHECK (public.has_permission ('registers', 'create'));

-- UPDATE policy (optimized)
create policy "users_can_update_register" on registers FOR
UPDATE
    USING (
        user_code = (
            select
                auth.uid()
        )
        OR public.has_permission ('registers', 'update')
    );

-- DELETE policy (optimized)
create policy "users_can_del_register" on registers FOR DELETE USING (public.has_permission ('registers', 'delete'));