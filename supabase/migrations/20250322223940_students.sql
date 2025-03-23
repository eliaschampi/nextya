CREATE TABLE students (
    code UUID DEFAULT gen_random_uuid() NOT NULL,
    name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(100),
    user_code UUID not null REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT student_pk PRIMARY KEY (code)
);

-- Enable Row Level Security
ALTER TABLE
    public.students ENABLE ROW LEVEL SECURITY;

-- Create a trigger function to update the updated_at column
CREATE
OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- Create a trigger that calls the function before an update
CREATE TRIGGER update_students_updated_at BEFORE
UPDATE
    ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Student index
CREATE INDEX students_name_last_name_gin ON students USING GIN (to_tsvector('english', name || ' ' || last_name));