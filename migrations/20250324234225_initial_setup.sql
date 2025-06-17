
CREATE TYPE public.entity_enum AS ENUM (
    'users', -- include permissions
    'levels',
    'courses',
    'students',
    'registers',
    'evals',
    'eval_sections',
    'eval_questions',
    'eval_answers',
    'eval_results'
);

-- Tables
CREATE TABLE public.permissions (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    user_code UUID NOT NULL,
    entity entity_enum NOT NULL,
    user_action VARCHAR(10) NOT NULL ,
    CONSTRAINT pk_permission PRIMARY KEY (code),
    CONSTRAINT fk_permissions_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_entity_user_code UNIQUE (entity, user_code, user_action)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;


-- Function to verify permissions
CREATE OR REPLACE FUNCTION public.has_permission(entity_name TEXT, permission TEXT) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.permissions
        WHERE user_code = (SELECT auth.uid())
          AND entity::text = entity_name
          AND user_action = permission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
