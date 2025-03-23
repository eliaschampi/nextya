CREATE TABLE registers (
  code UUID DEFAULT gen_random_uuid () NOT NULL,
  student_code UUID NOT NULL references public.students (code),
  level_code UUID NOT NULL references public.levels (code),
  group_name CHAR(1) NOT NULL,
  user_code UUID REFERENCES auth.users (id),
  roll_code CHAR(4) not null,
  is_active boolean DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT register_pk PRIMARY KEY (code)
);

-- Enable Row Level Security
ALTER TABLE
  public.registers ENABLE ROW LEVEL SECURITY;

-- View 2
create view public.student_registers with (security_invoker = true) as
select
  s.code as student_code,
  r.code as register_code,
  s.name,
  s.last_name,
  s.email,
  s.phone,
  r.roll_code,
  r.group_name,
  r.level_code,
  l.name as level,
  s.created_at
from
  public.registers r
  join public.students s on r.student_code = s.code
  join public.levels l on r.level_code = l.code;