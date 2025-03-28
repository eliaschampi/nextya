-- SELECT policy
CREATE POLICY "Users_can_view_eval_answers" ON eval_answers FOR
SELECT TO authenticated
    USING (TRUE);

-- INSERT policy
CREATE POLICY "users_can_insert_eval_answer" ON eval_answers FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('eval_answers', 'create'));

-- UPDATE policy
CREATE POLICY "users_can_update_eval_answer" ON eval_answers FOR
UPDATE TO authenticated
    USING (public.has_permission('eval_answers', 'update'));

-- DELETE policy
CREATE POLICY "users_can_del_eval_answer" ON eval_answers FOR DELETE TO authenticated
    USING (public.has_permission('eval_answers', 'delete'));
