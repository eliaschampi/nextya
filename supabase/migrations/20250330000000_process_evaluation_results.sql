-- Function to process evaluation results in a transaction
CREATE OR REPLACE FUNCTION public.process_evaluation_results(
    p_register_code UUID,
    p_eval_code UUID,
    p_answers JSONB,
    p_correct_count INT,
    p_blank_count INT,
    p_incorrect_count INT,
    p_score NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_answer JSONB;
    v_result_code UUID;
BEGIN
    -- Start transaction
    BEGIN
        -- Delete any existing answers for this register and evaluation
        DELETE FROM public.eval_answers 
        WHERE register_code = p_register_code 
        AND question_code IN (
            SELECT code FROM public.eval_questions WHERE eval_code = p_eval_code
        );
        
        -- Delete any existing results for this register and evaluation
        DELETE FROM public.eval_results 
        WHERE register_code = p_register_code 
        AND eval_code = p_eval_code;
        
        -- Insert new answers
        FOR v_answer IN SELECT jsonb_array_elements(p_answers)
        LOOP
            INSERT INTO public.eval_answers (
                register_code,
                question_code,
                student_answer
            ) VALUES (
                (v_answer->>'register_code')::UUID,
                (v_answer->>'question_code')::UUID,
                (v_answer->>'student_answer')::CHAR(1)
            );
        END LOOP;
        
        -- Insert overall result
        INSERT INTO public.eval_results (
            register_code,
            eval_code,
            section_code,
            correct_count,
            blank_count,
            incorrect_count,
            score,
            calculated_at
        ) VALUES (
            p_register_code,
            p_eval_code,
            NULL, -- Overall result, not section-specific
            p_correct_count,
            p_blank_count,
            p_incorrect_count,
            p_score,
            CURRENT_TIMESTAMP
        ) RETURNING code INTO v_result_code;
        
        -- Commit transaction
        COMMIT;
    EXCEPTION WHEN OTHERS THEN
        -- Rollback on error
        ROLLBACK;
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.process_evaluation_results TO authenticated;
