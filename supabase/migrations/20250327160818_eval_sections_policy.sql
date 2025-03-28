-- SELECT policy
CREATE POLICY "Users_can_view_eval_sections" ON eval_sections FOR
SELECT TO authenticated
    USING (TRUE);

-- INSERT policy
CREATE POLICY "users_can_insert_eval_section" ON eval_sections FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('eval_sections', 'create'));

-- UPDATE policy
CREATE POLICY "users_can_update_eval_section" ON eval_sections FOR
UPDATE TO authenticated
    USING (public.has_permission('eval_sections', 'update'));

-- DELETE policy
CREATE POLICY "users_can_del_eval_section" ON eval_sections FOR DELETE TO authenticated
    USING (public.has_permission('eval_sections', 'delete'));

