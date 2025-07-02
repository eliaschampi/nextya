-- =====================================================
-- NEXTYA DATABASE SCHEMA - TRIGGERS
-- =====================================================
-- Database triggers for automatic data management

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Trigger for users table
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- DATA VALIDATION TRIGGERS
-- =====================================================

-- Validate email format
CREATE OR REPLACE FUNCTION validate_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format: %', NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply email validation to users
CREATE TRIGGER trigger_users_validate_email
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_email();

-- Apply email validation to students
CREATE TRIGGER trigger_students_validate_email
    BEFORE INSERT OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION validate_email();

-- =====================================================
-- AUTOMATIC CALCULATION TRIGGERS
-- =====================================================

-- Function to calculate evaluation totals
CREATE OR REPLACE FUNCTION update_eval_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total questions in evaluation
    UPDATE evals 
    SET total_questions = (
        SELECT COUNT(*) 
        FROM eval_questions 
        WHERE eval_code = COALESCE(NEW.eval_code, OLD.eval_code)
    )
    WHERE code = COALESCE(NEW.eval_code, OLD.eval_code);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for eval_questions changes
CREATE TRIGGER trigger_eval_questions_update_totals
    AFTER INSERT OR UPDATE OR DELETE ON eval_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_eval_totals();

-- Function to update section totals
CREATE OR REPLACE FUNCTION update_section_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total questions in section
    UPDATE eval_sections 
    SET total_questions = (
        SELECT COUNT(*) 
        FROM eval_questions 
        WHERE section_code = COALESCE(NEW.section_code, OLD.section_code)
    )
    WHERE code = COALESCE(NEW.section_code, OLD.section_code);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for section question totals
CREATE TRIGGER trigger_eval_questions_update_section_totals
    AFTER INSERT OR UPDATE OR DELETE ON eval_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_section_totals();

-- =====================================================
-- ANSWER VALIDATION TRIGGERS
-- =====================================================

-- Function to validate and mark correct answers
CREATE OR REPLACE FUNCTION validate_answer()
RETURNS TRIGGER AS $$
DECLARE
    correct_answer CHAR(1);
BEGIN
    -- Get the correct answer for this question
    SELECT correct_key INTO correct_answer
    FROM eval_questions
    WHERE code = NEW.question_code;
    
    -- Mark if the answer is correct
    NEW.is_correct := (NEW.student_answer = correct_answer);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate answers
CREATE TRIGGER trigger_eval_answers_validate
    BEFORE INSERT OR UPDATE ON eval_answers
    FOR EACH ROW
    EXECUTE FUNCTION validate_answer();

-- =====================================================
-- RESULT CALCULATION TRIGGERS
-- =====================================================

-- Function to recalculate evaluation results
CREATE OR REPLACE FUNCTION recalculate_eval_results()
RETURNS TRIGGER AS $$
DECLARE
    register_id UUID;
    eval_id UUID;
    section_id UUID;
    total_correct INTEGER;
    total_incorrect INTEGER;
    total_blank INTEGER;
    total_questions INTEGER;
    calculated_score NUMERIC;
BEGIN
    -- Get the register and eval from the answer
    SELECT eq.eval_code, ea.register_code, eq.section_code
    INTO eval_id, register_id, section_id
    FROM eval_questions eq
    JOIN eval_answers ea ON eq.code = ea.question_code
    WHERE ea.code = COALESCE(NEW.code, OLD.code);
    
    -- Calculate totals for this register and section (or general eval)
    SELECT 
        COUNT(CASE WHEN ea.is_correct = true THEN 1 END),
        COUNT(CASE WHEN ea.is_correct = false AND ea.student_answer IS NOT NULL THEN 1 END),
        COUNT(CASE WHEN ea.student_answer IS NULL THEN 1 END),
        COUNT(*)
    INTO total_correct, total_incorrect, total_blank, total_questions
    FROM eval_answers ea
    JOIN eval_questions eq ON ea.question_code = eq.code
    WHERE ea.register_code = register_id
    AND eq.eval_code = eval_id
    AND (section_id IS NULL OR eq.section_code = section_id);
    
    -- Calculate score (assuming 20 points total, proportional)
    calculated_score := CASE 
        WHEN total_questions > 0 THEN 
            ROUND((total_correct::NUMERIC / total_questions) * 20, 2)
        ELSE 0 
    END;
    
    -- Update or insert the result
    INSERT INTO eval_results (eval_code, register_code, section_code, score, correct_count, incorrect_count, blank_count)
    VALUES (eval_id, register_id, section_id, calculated_score, total_correct, total_incorrect, total_blank)
    ON CONFLICT (eval_code, register_code, COALESCE(section_code, '00000000-0000-0000-0000-000000000000'::UUID))
    DO UPDATE SET
        score = calculated_score,
        correct_count = total_correct,
        incorrect_count = total_incorrect,
        blank_count = total_blank,
        created_at = CURRENT_TIMESTAMP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate results when answers change
CREATE TRIGGER trigger_eval_answers_recalculate_results
    AFTER INSERT OR UPDATE OR DELETE ON eval_answers
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_eval_results();

-- =====================================================
-- AUDIT TRIGGERS (Optional - for future use)
-- =====================================================

-- Function to log important changes
CREATE OR REPLACE FUNCTION log_important_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- This could be expanded to log changes to an audit table
    -- For now, just ensure we have proper timestamps
    
    IF TG_OP = 'UPDATE' THEN
        -- Log that an update occurred
        RAISE NOTICE 'Updated % record with ID %', TG_TABLE_NAME, NEW.code;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Example audit trigger (commented out for now)
-- CREATE TRIGGER trigger_users_audit
--     AFTER UPDATE ON users
--     FOR EACH ROW
--     EXECUTE FUNCTION log_important_changes();
