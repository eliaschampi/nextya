-- SELECT policy
CREATE POLICY "Users_can_view_eval_results" ON eval_results FOR
SELECT TO authenticated
    USING (TRUE);

-- INSERT policy
CREATE POLICY "users_can_insert_eval_result" ON eval_results FOR
INSERT TO authenticated
    WITH CHECK (
        -- Users can insert results for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_results', 'create')
    );

-- UPDATE policy
CREATE POLICY "users_can_update_eval_result" ON eval_results FOR
UPDATE TO authenticated
    USING (
        -- Users can update results for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_results', 'update')
    );

-- DELETE policy
CREATE POLICY "users_can_del_eval_result" ON eval_results FOR DELETE TO authenticated
    USING (
        -- Users can delete results for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_results', 'delete')
    );
