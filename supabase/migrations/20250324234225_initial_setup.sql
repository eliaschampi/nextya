-- Tables
CREATE TABLE public.permissions (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    user_code UUID NOT NULL,
    entity VARCHAR(100) NOT NULL,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_update BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT pk_permission PRIMARY KEY (code),
    CONSTRAINT fk_permissions_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_entity_user_code UNIQUE (entity, user_code)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;


-- Function to verify permissions
CREATE OR REPLACE FUNCTION public.has_permission(entity_name TEXT, permission TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.permissions
        WHERE user_code = (SELECT auth.uid())
          AND entity = entity_name
          AND (
                (permission = 'create' AND can_create = true)
             OR (permission = 'update' AND can_update = true)
             OR (permission = 'delete' AND can_delete = true)
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for permissions
CREATE POLICY read_permissions ON public.permissions 
    FOR SELECT TO authenticated
    USING (true);
