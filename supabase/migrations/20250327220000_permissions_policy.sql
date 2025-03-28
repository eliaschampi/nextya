-- Policies for permissions
CREATE POLICY "Users_can_view_permissions" ON public.permissions 
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users_can_insert_permissions" ON permissions 
    FOR INSERT
    WITH CHECK (
        (SELECT auth.uid()) IN (
            SELECT id 
            FROM auth.users 
            WHERE is_super_admin = true
        )
    );

CREATE POLICY "Users_can_update_permissions" ON permissions 
    FOR UPDATE
    USING (
        (SELECT auth.uid()) IN (
            SELECT id 
            FROM auth.users 
            WHERE is_super_admin = true
        )
    );

CREATE POLICY "Users_can_del_permissions" ON permissions 
    FOR DELETE
    USING (
        (SELECT auth.uid()) IN (
            SELECT id 
            FROM auth.users 
            WHERE is_super_admin = true
        )
    );