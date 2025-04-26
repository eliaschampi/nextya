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
  -- Validate group_name (constraint check)
  IF p_group_name NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'Invalid group_name: %. Must be one of A, B, C, D', p_group_name;
  END IF;

  -- Normalize inputs
  p_name := TRIM(p_name);
  p_last_name := TRIM(p_last_name);
  p_phone := NULLIF(TRIM(p_phone), '');
  p_email := NULLIF(TRIM(p_email), '');
  p_roll_code := TRIM(p_roll_code);

  -- More precise student lookup - prioritize name+lastname match
  SELECT code INTO v_existing_student_code
  FROM students
  WHERE (name = p_name AND last_name = p_last_name)
     OR (p_email IS NOT NULL AND email = p_email);

  -- Process student record
  IF v_existing_student_code IS NOT NULL THEN
    v_student_code := v_existing_student_code;

    -- Update student data if needed - only update if new data is provided
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

  -- Process register record - use UPSERT pattern for better performance
  INSERT INTO registers (student_code, level_code, group_name, roll_code, user_code)
  VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code)
  ON CONFLICT (student_code, level_code, group_name)
  DO UPDATE SET roll_code = EXCLUDED.roll_code;
END;
$$ LANGUAGE plpgsql;
