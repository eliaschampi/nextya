CREATE TABLE registers (
  code UUID DEFAULT gen_random_uuid(),
  student_code UUID NOT NULL,
  level_code UUID NOT NULL,
  group_name CHAR(1) NOT NULL,
  user_code UUID NOT NULL,
  roll_code CHAR(4) not null,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_register PRIMARY KEY (code),
  CONSTRAINT fk_registers_student FOREIGN KEY (student_code) REFERENCES public.students(code) ON DELETE CASCADE,
  CONSTRAINT fk_registers_level FOREIGN KEY (level_code) REFERENCES public.levels(code) ON DELETE CASCADE,
  CONSTRAINT fk_registers_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT uq_student_student_level_group UNIQUE (student_code, level_code, group_name),
  CONSTRAINT uq_registers_roll_code UNIQUE (level_code, roll_code),
  CONSTRAINT ck_registers_group CHECK (group_name IN ('A','B','C','D'))
);

-- Enable Row Level Security
ALTER TABLE public.registers ENABLE ROW LEVEL SECURITY;

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