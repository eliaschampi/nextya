CREATE TABLE courses (
    code UUID DEFAULT gen_random_uuid (),
    name VARCHAR(100) not null,
    user_code UUID not null REFERENCES auth.users (id),
    description TEXT not null,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT course_pk PRIMARY KEY (code)
);

-- Enable Row Level Security
ALTER TABLE
    public.courses ENABLE ROW LEVEL SECURITY;