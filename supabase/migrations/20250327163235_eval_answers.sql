CREATE TABLE public.eval_answers (
    code UUID DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    question_code UUID NOT NULL,
    student_answer CHAR(1), 
    CONSTRAINT pk_eval_answers PRIMARY KEY (code),
    CONSTRAINT fk_eval_answers_register FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_answers_question FOREIGN KEY (question_code) REFERENCES public.eval_questions(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_answers_unique UNIQUE (register_code, question_code),
    CONSTRAINT ck_eval_answers_answer CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL)
);

ALTER TABLE public.eval_answers ENABLE ROW LEVEL SECURITY;

