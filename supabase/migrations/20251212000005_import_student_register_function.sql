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
  -- Log input parameters for debugging
  RAISE NOTICE 'Import student register: name=%, last_name=%, level_code=%, group_name=%, roll_code=%',
    p_name, p_last_name, p_level_code, p_group_name, p_roll_code;

  -- Validate group_name
  IF p_group_name NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'Invalid group_name: %. Must be one of A, B, C, D', p_group_name;
  END IF;

  -- Check if student already exists by email or name+lastname
  SELECT code INTO v_existing_student_code
  FROM students
  WHERE (email = p_email AND p_email IS NOT NULL AND p_email != '')
     OR (name = p_name AND last_name = p_last_name);

  -- Log if student exists
  IF v_existing_student_code IS NOT NULL THEN
    RAISE NOTICE 'Found existing student with code %', v_existing_student_code;
    v_student_code := v_existing_student_code;

    -- Update student data if needed
    UPDATE students
    SET
      phone = COALESCE(NULLIF(p_phone, ''), phone),
      email = COALESCE(NULLIF(p_email, ''), email)
    WHERE code = v_student_code;

    RAISE NOTICE 'Updated existing student data';
  ELSE
    -- Insert new student
    BEGIN
      INSERT INTO students (name, last_name, phone, email, user_code)
      VALUES (p_name, p_last_name, p_phone, p_email, p_user_code)
      RETURNING code INTO v_student_code;

      RAISE NOTICE 'Created new student with code %', v_student_code;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error creating student: %', SQLERRM;
    END;
  END IF;

  -- Check if register already exists
  IF EXISTS (
    SELECT 1 FROM registers
    WHERE student_code = v_student_code
      AND level_code = p_level_code
      AND group_name = p_group_name
  ) THEN
    -- Update existing register
    BEGIN
      UPDATE registers
      SET roll_code = p_roll_code
      WHERE student_code = v_student_code
        AND level_code = p_level_code
        AND group_name = p_group_name;

      RAISE NOTICE 'Updated existing register with roll_code %', p_roll_code;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error updating register: %', SQLERRM;
    END;
  ELSE
    -- Insert new register
    BEGIN
      INSERT INTO registers (student_code, level_code, group_name, roll_code, user_code)
      VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code);

      RAISE NOTICE 'Created new register with roll_code %', p_roll_code;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error creating register: %', SQLERRM;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;
