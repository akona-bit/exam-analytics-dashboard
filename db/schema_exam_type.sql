-- =====================================================
-- Migration: tách kì thi khảo sát khỏi kì thi thử
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- Nếu database đã có dữ liệu, toàn bộ dữ liệu cũ mặc định
-- được gán là 'survey' (kì thi khảo sát).
-- =====================================================

ALTER TABLE students          ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';
ALTER TABLE questions         ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';
ALTER TABLE student_responses ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';

UPDATE students          SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';
UPDATE questions         SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';
UPDATE student_responses SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';

CREATE INDEX IF NOT EXISTS idx_students_exam_type ON students(exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_responses_exam_type ON student_responses(exam_type);