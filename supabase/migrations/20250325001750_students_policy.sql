-- SELECT policy (unchanged)
CREATE POLICY "Users_can_view_students" ON students FOR
SELECT TO authenticated
    USING (TRUE);

-- INSERT policy (optimized)
CREATE POLICY "users_can_insert_student" ON students FOR
INSERT TO authenticated
    WITH CHECK (public.has_permission('students', 'create'));

-- UPDATE policy (optimized)
CREATE POLICY "users_can_update_student" ON students FOR
UPDATE TO authenticated
    USING (
        user_code = (SELECT auth.uid())
        OR public.has_permission('students', 'update')
    );

-- DELETE policy (optimized)
CREATE POLICY "users_can_del_student" ON students FOR DELETE TO authenticated
    USING (public.has_permission('students', 'delete'));