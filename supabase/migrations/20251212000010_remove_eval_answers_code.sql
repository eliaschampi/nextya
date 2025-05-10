-- Migration to remove the code column from eval_answers table
-- and make (register_code, question_code) the primary key

-- Step 1: Drop the existing primary key constraint
ALTER TABLE public.eval_answers DROP CONSTRAINT pk_eval_answers;

-- Step 2: Drop the code column
ALTER TABLE public.eval_answers DROP COLUMN code;

-- Step 3: Make the combination of register_code and question_code the primary key
-- Note: We already have a unique constraint (uq_eval_answers_unique) on these columns,
-- so we can just promote it to be the primary key
ALTER TABLE public.eval_answers 
  DROP CONSTRAINT uq_eval_answers_unique,
  ADD CONSTRAINT pk_eval_answers PRIMARY KEY (register_code, question_code);

-- Step 4: Update any functions that might be using the code column
-- The upsert_eval_results function doesn't use the code column, so no changes needed there
