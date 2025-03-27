CREATE TABLE levels (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_code UUID NOT NULL,
    modality TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_level PRIMARY KEY (code),
    CONSTRAINT fk_levels_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;