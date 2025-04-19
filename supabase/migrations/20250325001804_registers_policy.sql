-- SELECT policy (unchanged)
CREATE POLICY "Users_can_view_registers" ON registers FOR
SELECT TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('registers', 'read')
    );

-- INSERT policy (optimized)
CREATE POLICY "users_can_insert_register" ON registers FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('registers', 'create'));

-- UPDATE policy (optimized)
CREATE POLICY "users_can_update_register" ON registers FOR
UPDATE TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('registers', 'update')
    );

-- DELETE policy (optimized)
CREATE POLICY "users_can_del_register" ON registers FOR DELETE TO authenticated
    USING (public.has_permission('registers', 'delete'));