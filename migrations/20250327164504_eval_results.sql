CREATE TABLE public.eval_results (
    code UUID DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    eval_code UUID NOT NULL,
    section_code UUID NULL,
    correct_count INT NOT NULL DEFAULT 0,
    blank_count INT NOT NULL DEFAULT 0,
    incorrect_count INT NOT NULL DEFAULT 0,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_eval_results PRIMARY KEY (code),
    CONSTRAINT fk_eval_results_register FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_results_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_results_section FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_results_unique UNIQUE (register_code, eval_code, section_code)
);

ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;
