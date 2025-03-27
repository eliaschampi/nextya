CREATE TABLE public.evals (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    level_code UUID NOT NULL,
    group_name CHAR(1) NOT NULL,
    eval_date DATE NOT NULL,
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_evals PRIMARY KEY (code),
    CONSTRAINT fk_evals_level FOREIGN KEY (level_code) REFERENCES public.levels(code), 
    CONSTRAINT fk_evals_user FOREIGN KEY (user_code) REFERENCES auth.users(id), 
    CONSTRAINT ck_evals_group CHECK (group_name IN ('A','B','C','D'))
);

CREATE TRIGGER tg_eval_updated_at
BEFORE UPDATE ON public.evals
FOR EACH ROW
EXECUTE FUNCTION public.timestamp_updater();

ALTER TABLE public.evals ENABLE ROW LEVEL SECURITY;




