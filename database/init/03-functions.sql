-- =====================================================
-- NextYa Database Functions
-- =====================================================

-- =====================================================
-- EVALUATION FUNCTIONS
-- =====================================================



-- Upsert eval results function
CREATE OR REPLACE FUNCTION public.upsert_eval_results (
  p_eval_code uuid,
  p_register_code uuid,
  p_answers JSONB, -- Array de objetos: { question_code: uuid, student_answer: text }
  p_general_result JSONB, -- Objeto: { correct_count, incorrect_count, blank_count, score }
  p_section_results JSONB -- Objeto: { section_code: { correct_count, incorrect_count, blank_count, score } }
) RETURNS void AS $$
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

-- Import student register function
CREATE OR REPLACE FUNCTION public.import_student_register (
  p_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_level_code UUID,
  p_group_name TEXT,
  p_roll_code TEXT,
  p_user_code UUID
) RETURNS VOID AS $$
DECLARE
  v_student_code UUID;
  v_existing_student_code UUID;
BEGIN
  -- Validate group_name (constraint check)
  IF p_group_name NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'Invalid group_name: %. Must be one of A, B, C, D', p_group_name;
  END IF;

  -- Check if student already exists by email
  SELECT code INTO v_existing_student_code
  FROM public.students
  WHERE email = p_email AND user_code = p_user_code;

  IF v_existing_student_code IS NOT NULL THEN
    -- Student exists, use existing student_code
    v_student_code := v_existing_student_code;
  ELSE
    -- Create new student
    INSERT INTO public.students (name, last_name, phone, email, user_code)
    VALUES (p_name, p_last_name, p_phone, p_email, p_user_code)
    RETURNING code INTO v_student_code;
  END IF;

  -- Create register (this will fail if duplicate roll_code or student already registered in same level/group)
  INSERT INTO public.registers (student_code, level_code, group_name, roll_code, user_code)
  VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code);

EXCEPTION
  WHEN unique_violation THEN
    -- Get the constraint name to provide specific error message
    GET STACKED DIAGNOSTICS v_existing_student_code = CONSTRAINT_NAME;

    IF v_existing_student_code = 'uq_registers_roll_code' THEN
      RAISE EXCEPTION 'Roll code % already exists in this level', p_roll_code;
    ELSIF v_existing_student_code = 'uq_student_student_level_group' THEN
      RAISE EXCEPTION 'Student % is already registered in group % for this level', p_email, p_group_name;
    ELSE
      RAISE EXCEPTION 'Registration failed due to duplicate data: %', v_existing_student_code;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
