CREATE TABLE public.eval_questions (
    code UUID DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    section_code UUID NOT NULL,
    order_in_eval INT NOT NULL,
    correct_key CHAR(1) NOT NULL,
    omitable BOOLEAN DEFAULT FALSE,
    score_percent NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    CONSTRAINT pk_eval_questions PRIMARY KEY (code),
    CONSTRAINT fk_eval_questions_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_questions_section FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_questions_order UNIQUE (eval_code, order_in_eval),
    CONSTRAINT ck_correct_key_questions CHECK (correct_key IN ('A','B','C','D','E')),
    CONSTRAINT ck_score_questions CHECK (score_percent BETWEEN 0 AND 1)
);

ALTER TABLE public.eval_questions ENABLE ROW LEVEL SECURITY;


