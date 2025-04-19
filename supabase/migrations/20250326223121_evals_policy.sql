-- SELECT policy (unchanged)
CREATE POLICY "Users_can_view_evals" ON evals FOR
SELECT TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('evals', 'read')
    );

-- INSERT policy (optimized)
CREATE POLICY "users_can_insert_eval" ON evals FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('evals', 'create'));

-- UPDATE policy (optimized)
CREATE POLICY "users_can_update_eval" ON evals FOR
UPDATE TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('evals', 'update')
    );

-- DELETE policy (optimized)
CREATE POLICY "users_can_del_eval" ON evals FOR DELETE TO authenticated
    USING (public.has_permission('evals', 'delete'));