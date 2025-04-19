-- SELECT policy (unchanged)
CREATE POLICY "Users_can_view_levels" ON levels FOR
SELECT TO authenticated
    USING (public.has_permission('levels', 'read'));

-- INSERT policy (optimized)
CREATE POLICY "users_can_insert_level" ON levels FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('levels', 'create'));

-- UPDATE policy (optimized)
CREATE POLICY "users_can_update_level" ON levels FOR
UPDATE TO authenticated
    USING (public.has_permission('levels', 'update'));

-- DELETE policy (optimized)
CREATE POLICY "users_can_del_level" ON levels FOR DELETE TO authenticated
    USING (public.has_permission('levels', 'delete'));