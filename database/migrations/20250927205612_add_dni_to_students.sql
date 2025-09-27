-- =====================================================
-- Migration: Add DNI column to students table
-- Date: 2025-01-27
-- Purpose: Enable integration between Nextya and Aeduca systems
-- =====================================================

-- Add dni column to students table
ALTER TABLE public.students 
ADD COLUMN dni CHAR(8) NULL;

-- Create unique index for dni (excluding NULL values)
CREATE UNIQUE INDEX uq_students_dni 
ON public.students(dni) 
WHERE dni IS NOT NULL;
