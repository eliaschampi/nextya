-- SELECT policy
CREATE POLICY "Users_can_view_courses" ON courses FOR
SELECT TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('courses', 'read')
    );

-- INSERT policy
CREATE POLICY "users_can_insert_course" ON courses FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('courses', 'create'));

-- UPDATE policy
CREATE POLICY "users_can_update_course" ON courses FOR
UPDATE TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('courses', 'update')
    );

-- DELETE policy
CREATE POLICY "users_can_del_course" ON courses FOR DELETE TO authenticated
    USING (public.has_permission('courses', 'delete'));