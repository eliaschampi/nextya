-- Add order field to courses table
ALTER TABLE courses DROP COLUMN "abr";
-- Add order field to courses table
ALTER TABLE courses ADD COLUMN "order" INTEGER DEFAULT 0;

-- Update existing courses to have sequential order
WITH indexed_courses AS (
  SELECT code, ROW_NUMBER() OVER (ORDER BY created_at) AS row_num
  FROM courses
)
UPDATE courses
SET "order" = indexed_courses.row_num
FROM indexed_courses
WHERE courses.code = indexed_courses.code;
