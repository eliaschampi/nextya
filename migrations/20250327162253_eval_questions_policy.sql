-- SELECT policy
CREATE POLICY "Users_can_view_eval_questions" ON eval_questions FOR
SELECT TO authenticated
    USING (public.has_permission('eval_questions', 'read'));

-- INSERT policy
CREATE POLICY "users_can_insert_eval_question" ON eval_questions FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('eval_questions', 'create'));

-- UPDATE policy
CREATE POLICY "users_can_update_eval_question" ON eval_questions FOR
UPDATE TO authenticated
    USING (public.has_permission('eval_questions', 'update'));

-- DELETE policy
CREATE POLICY "users_can_del_eval_question" ON eval_questions FOR DELETE TO authenticated
    USING (public.has_permission('eval_questions', 'delete'));
