-- SELECT policy
CREATE POLICY "Users_can_view_eval_answers" ON eval_answers FOR
SELECT TO authenticated
    USING (TRUE);

-- INSERT policy
CREATE POLICY "users_can_insert_eval_answer" ON eval_answers FOR
INSERT TO authenticated
    WITH CHECK (
        -- Users can insert answers for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_answers', 'create')
    );

-- UPDATE policy
CREATE POLICY "users_can_update_eval_answer" ON eval_answers FOR
UPDATE TO authenticated
    USING (
        -- Users can update answers for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_answers', 'update')
    );

-- DELETE policy
CREATE POLICY "users_can_del_eval_answer" ON eval_answers FOR DELETE TO authenticated
    USING (
        -- Users can delete answers for their own register
        register_code IN (SELECT code FROM registers WHERE user_code = auth.uid())
        OR public.has_permission('eval_answers', 'delete')
    );
