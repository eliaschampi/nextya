CREATE TABLE public.eval_sections (
    code UUID DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    course_code UUID NOT NULL,
    order_in_eval INT NOT NULL, 
    question_count INT NOT NULL,
    CONSTRAINT pk_eval_sections PRIMARY KEY (code),
    CONSTRAINT fk_eval_sections_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_sections_course FOREIGN KEY (course_code) REFERENCES public.courses(code),
    CONSTRAINT uq_eval_sections_eval_course UNIQUE (eval_code, course_code), 
    CONSTRAINT uq_eval_sections_eval_order UNIQUE (eval_code, order_in_eval) 
);

ALTER TABLE public.eval_sections ENABLE ROW LEVEL SECURITY;


