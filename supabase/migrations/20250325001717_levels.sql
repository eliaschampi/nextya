CREATE TABLE levels (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    abr TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    users UUID[] NOT NULL,
    CONSTRAINT pk_level PRIMARY KEY (code)
);

-- Enable Row Level Security
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;