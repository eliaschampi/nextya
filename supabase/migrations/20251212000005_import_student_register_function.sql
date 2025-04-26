-- Create a function to import a student and register in a single transaction
CREATE OR REPLACE FUNCTION import_student_register(
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
  -- Check if student already exists by email or name+lastname
  SELECT code INTO v_existing_student_code
  FROM students
  WHERE (email = p_email AND p_email IS NOT NULL) 
     OR (name = p_name AND last_name = p_last_name);
  
  -- If student exists, use that code
  IF v_existing_student_code IS NOT NULL THEN
    v_student_code := v_existing_student_code;
    
    -- Update student data if needed
    UPDATE students
    SET 
      phone = COALESCE(p_phone, phone),
      email = COALESCE(p_email, email)
    WHERE code = v_student_code;
  ELSE
    -- Insert new student
    INSERT INTO students (name, last_name, phone, email, user_code)
    VALUES (p_name, p_last_name, p_phone, p_email, p_user_code)
    RETURNING code INTO v_student_code;
  END IF;
  
  -- Check if register already exists
  IF EXISTS (
    SELECT 1 FROM registers 
    WHERE student_code = v_student_code 
      AND level_code = p_level_code 
      AND group_name = p_group_name
  ) THEN
    -- Update existing register
    UPDATE registers
    SET roll_code = p_roll_code
    WHERE student_code = v_student_code 
      AND level_code = p_level_code 
      AND group_name = p_group_name;
  ELSE
    -- Insert new register
    INSERT INTO registers (student_code, level_code, group_name, roll_code, user_code)
    VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code);
  END IF;
END;
$$ LANGUAGE plpgsql;
