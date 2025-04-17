CREATE OR REPLACE FUNCTION upsert_eval_results(
    p_eval_code uuid,
    p_register_code uuid,
    p_answers jsonb, -- Array de objetos: { question_code: uuid, student_answer: text }
    p_general_result jsonb, -- Objeto: { correct_count, incorrect_count, blank_count, score }
    p_section_results jsonb -- Objeto: { section_code: { correct_count, incorrect_count, blank_count, score } }
)
RETURNS void AS $$
DECLARE
    v_answer record;
    v_section_code uuid;
    v_section_result jsonb;
    v_existing_result_code uuid;
BEGIN
    -- 1. Eliminar respuestas y resultados anteriores para esta evaluación y registro
    DELETE FROM public.eval_answers
    WHERE register_code = p_register_code
      AND question_code IN (SELECT code FROM public.eval_questions WHERE eval_code = p_eval_code);

    DELETE FROM public.eval_results
    WHERE register_code = p_register_code
      AND eval_code = p_eval_code;

    -- 2. Insertar nuevas respuestas
    FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_code uuid, student_answer text)
    LOOP
        INSERT INTO public.eval_answers (register_code, question_code, student_answer)
        VALUES (p_register_code, v_answer.question_code, v_answer.student_answer);
    END LOOP;

    -- 3. Insertar resultado general
    INSERT INTO public.eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
    VALUES (
        p_register_code,
        p_eval_code,
        NULL, -- NULL section_code para resultado general
        (p_general_result->>'correct_count')::int,
        (p_general_result->>'incorrect_count')::int,
        (p_general_result->>'blank_count')::int,
        (p_general_result->>'score')::numeric
    );

    -- 4. Insertar resultados por sección
    FOR v_section_code, v_section_result IN SELECT * FROM jsonb_each(p_section_results)
    LOOP
        INSERT INTO public.eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
        VALUES (
            p_register_code,
            p_eval_code,
            v_section_code,
            (v_section_result->>'correct_count')::int,
            (v_section_result->>'incorrect_count')::int,
            (v_section_result->>'blank_count')::int,
            (v_section_result->>'score')::numeric
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql;