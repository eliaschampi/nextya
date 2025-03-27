CREATE TABLE students (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(100),
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_student PRIMARY KEY (code),
    CONSTRAINT fk_students_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_name_lastname UNIQUE (name, last_name)
);

-- Enable Row Level Security
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create a trigger function to update the updated_at column
CREATE
OR REPLACE FUNCTION timestamp_updater()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that calls the function before an update
CREATE TRIGGER tg_student_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.timestamp_updater();