# Supabase to Kysely Migration: Current State Analysis

## 1. Auth & Sessions Implementation

- **Auth is handled via Supabase:**
  - Login: `src/routes/auth/+page.server.ts` uses `locals.supabase.auth.signInWithPassword`.
  - Logout: `src/routes/api/logout/+server.ts` uses `locals.supabase.auth.signOut`.
  - User management: `src/routes/api/users/+server.ts` uses `supabaseAdmin.auth.admin.listUsers()`.
  - Supabase clients: `src/lib/supabaseClient.ts` and `src/lib/supabaseAdmin.ts`.

**Sessions** are managed by Supabase, with user context available in `locals.supabase`.

### Authentication Middleware & Session Handling (Detailed)

#### 1. `src/hooks.server.ts`
- **Purpose:** Global middleware for all requests. Sets up Supabase SSR client and attaches helpers to `event.locals`.
- **Key logic:**
  - `event.locals.supabase`: SSR Supabase client, configured with cookies for session persistence.
  - `event.locals.getSession()`: Returns the current session (fast, but does not validate JWT).
  - `event.locals.getUser()`: Returns the authenticated user (validates JWT, more secure).
  - `event.locals.safeGetSession()`: Combines both—returns `{ session, user }` only if JWT is valid.
- **Usage:** All server-side endpoints and loads can access the current session/user securely via these helpers.

#### 2. `src/routes/+layout.server.ts`
- **Purpose:** Loads session and user for every server-side page/layout.
- **Key logic:**
  - Calls `locals.safeGetSession()` to get both session and user, ensuring JWT is validated.
  - Returns `{ session, user, cookies, title }` to the client, making session/user available in all layouts and pages.
- **Usage:** Ensures every page has access to up-to-date session and user info on the server.

#### 3. `src/routes/+layout.ts`
- **Purpose:** Handles session and user on the client, and sets up the Supabase client for browser/server.
- **Key logic:**
  - Uses `depends('supabase:auth')` to allow session invalidation on auth changes.
  - Creates Supabase client (browser or server) with correct cookies and fetch context.
  - Reads session from Supabase client (`supabase.auth.getSession()`), which is safe on the client and uses server-validated data on the server.
- **Usage:** Ensures session/user are available reactively on the client, and can be invalidated/refreshed as needed.

#### 4. `src/routes/+layout.svelte`
- **Purpose:** UI-level session management and reactivity.
- **Key logic:**
  - Listens for `supabase.auth.onAuthStateChange` events.
  - If session changes (e.g., login/logout/refresh), calls `invalidate('supabase:auth')` to trigger a reload of session data in the layout.
  - Ensures UI always reflects the current authentication state.

#### Summary
- **Server-side:** Securely attaches session/user to every request and page via hooks and server load.
- **Client-side:** Keeps session/user in sync with Supabase, and updates UI reactively on auth changes.
- **Migration Note:** When moving to Kysely/Postgres, you will need to replace Supabase auth/session logic with a custom or third-party solution (e.g., Passport.js, Lucia, or custom JWT/session management), and update these hooks/layouts accordingly.

## 2. Database Structure (from Supabase SQL Migrations)

### Tables

#### levels
```sql
CREATE TABLE levels (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    abr TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    users UUID[] NOT NULL,
    CONSTRAINT pk_level PRIMARY KEY (code)
);
```
#### courses
```sql
CREATE TABLE courses (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_code UUID NOT NULL,
    abr TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_course PRIMARY KEY (code),
    CONSTRAINT fk_courses_user FOREIGN KEY (user_code) REFERENCES auth.users(id) ON DELETE CASCADE
);
```
#### students
```sql
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
```
#### registers
```sql
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
```
#### evals
```sql
CREATE TABLE public.evals (
    code UUID DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    level_code UUID NOT NULL,
    group_name CHAR(1) NOT NULL,
    eval_date DATE NOT NULL,
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_evals PRIMARY KEY (code),
    CONSTRAINT fk_evals_level FOREIGN KEY (level_code) REFERENCES public.levels(code), 
    CONSTRAINT fk_evals_user FOREIGN KEY (user_code) REFERENCES auth.users(id), 
    CONSTRAINT ck_evals_group CHECK (group_name IN ('A','B','C','D'))
);
```
#### eval_sections
```sql
CREATE TABLE public.eval_sections (
    code UUID DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    course_code UUID NOT NULL,
    order_in_eval INT NOT NULL, 
    question_count INT NOT NULL,
    CONSTRAINT pk_eval_sections PRIMARY KEY (code),
    CONSTRAINT fk_eval_sections_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_sections_course FOREIGN KEY (course_code) REFERENCES public.courses(code),
    CONSTRAINT uq_eval_sections_eval_course UNIQUE (eval_code, course_code), 
    CONSTRAINT uq_eval_sections_eval_order UNIQUE (eval_code, order_in_eval) 
);
```
#### eval_questions
```sql
CREATE TABLE public.eval_questions (
    code UUID DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    section_code UUID NOT NULL,
    order_in_eval INT NOT NULL,
    correct_key CHAR(1) NOT NULL,
    omitable BOOLEAN DEFAULT FALSE,
    score_percent NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    CONSTRAINT pk_eval_questions PRIMARY KEY (code),
    CONSTRAINT fk_eval_questions_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_questions_section FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_questions_order UNIQUE (eval_code, order_in_eval),
    CONSTRAINT ck_correct_key_questions CHECK (correct_key IN ('A','B','C','D','E')),
    CONSTRAINT ck_score_questions CHECK (score_percent BETWEEN 0 AND 1)
);
```
#### eval_answers
```sql
CREATE TABLE public.eval_answers (
    code UUID DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    question_code UUID NOT NULL,
    student_answer TEXT, 
    CONSTRAINT pk_eval_answers PRIMARY KEY (code),
    CONSTRAINT fk_eval_answers_register FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_answers_question FOREIGN KEY (question_code) REFERENCES public.eval_questions(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_answers_unique UNIQUE (register_code, question_code),
    CONSTRAINT ck_eval_answers_answer CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL)
);
```
#### eval_results
```sql
CREATE TABLE public.eval_results (
    code UUID DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    eval_code UUID NOT NULL,
    section_code UUID NULL,
    correct_count INT NOT NULL DEFAULT 0,
    blank_count INT NOT NULL DEFAULT 0,
    incorrect_count INT NOT NULL DEFAULT 0,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_eval_results PRIMARY KEY (code),
    CONSTRAINT fk_eval_results_register FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_results_eval FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT fk_eval_results_section FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT uq_eval_results_unique UNIQUE (register_code, eval_code, section_code)
);
```

### Views
- `student_registers`: Joins students, registers, and levels for reporting.

### Policies (RLS)
- Each table has Row Level Security enabled and policies for SELECT, INSERT, UPDATE, DELETE, often using `public.has_permission` and user checks.

## 3. API Performance (src/routes/api)
- The API is organized by resource (users, student, eval, dashboard, impcsv, etc).
- Endpoints are implemented as SvelteKit server routes, using Supabase for DB access.
- Performance will depend on query efficiency and Supabase's latency. Migration to Kysely/Postgres will allow for direct query optimization.

## 4. Schema & Types
- Zod schemas for validation: `src/lib/schemas/student.ts`, `src/lib/schemas/eval.ts`.
- TypeScript types for tables and API: `src/lib/types/` (studentResults, dashboard, permissions, etc).
- Types are currently inferred from Supabase's generated types (see `Database` type usage in `src/lib/types/index.ts`).

## 5. Kysely Architecture & Migration Notes
- Kysely is a type-safe SQL query builder for TypeScript.
- You define a `Database` interface describing your tables and columns.
- Migrations are written as TypeScript files with `up` and `down` functions, using the Kysely schema API.
- Types can be generated from the database using tools like `kysely-codegen`.

## 6. Next Steps
- Define a new `Database` interface for Kysely based on current SQL migrations.
- Re-implement auth/session logic using self-hosted Postgres (consider alternatives for user/session management).
- Migrate Zod schemas and TypeScript types to match the new Kysely-based structure.
- Re-implement API endpoints to use Kysely for DB access.

---

This file documents the current state of the project for the Supabase to Kysely/Postgres migration. Further steps will include detailed schema migration, type generation, and API refactoring.
