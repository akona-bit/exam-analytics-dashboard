-- =====================================================
-- Exam Analytics Dashboard — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
--
-- ⚠️  CHỈ dùng cho database TRỐNG (cài mới).
--     File này dùng CREATE POLICY, mà PostgreSQL không có IF NOT EXISTS cho
--     câu đó — chạy lại trên database đã có policy sẽ dừng ở:
--       ERROR 42710: policy "public_read_students" ... already exists
--
--     Database đang chạy rồi thì dùng `schema_migrate.sql`, chạy lại vô hạn lần
--     và không mất dữ liệu.
-- =====================================================

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stt         INTEGER NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  tho_tv      FLOAT,
  tho_ta      FLOAT,
  tho_toan    FLOAT,
  tho_tdkh    FLOAT,
  irt_tv      FLOAT,
  irt_ta      FLOAT,
  irt_toan    FLOAT,
  irt_tdkh    FLOAT,
  tp_tv       FLOAT,
  tp_ta       FLOAT,
  tp_toan     FLOAT,
  tp_tdkh     FLOAT,
  note        TEXT DEFAULT '',
  exam_type   TEXT NOT NULL DEFAULT 'survey',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id     TEXT NOT NULL,
  subject         TEXT NOT NULL,
  exam_type       TEXT NOT NULL DEFAULT 'survey',
  total_attempts  INTEGER,
  correct         INTEGER,
  incorrect       INTEGER,
  penalty_score   FLOAT,
  bonus1          FLOAT,
  bonus2          FLOAT,
  bonus3          FLOAT,
  bonus_correct   FLOAT,
  is_error        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Student responses table (wrong/missing only, like the existing format)
CREATE TABLE IF NOT EXISTS student_responses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_type    TEXT NOT NULL DEFAULT 'survey',
  student_stt  INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  question_num INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'wrong',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Exam settings table (key-value for exam configuration)
CREATE TABLE IF NOT EXISTS exam_settings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- RLS Policies
-- Đọc: mở cho mọi người, dashboard công khai dùng anon key.
-- Ghi / sửa / xoá: chỉ email nằm trong public.is_admin().
-- Thêm email mới thì sửa is_admin() rồi chạy lại schema_migrate.sql.
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'minhducle629@gmail.com'
  ]::text[]);
$$;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_students" ON students FOR SELECT USING (true);
CREATE POLICY "public_read_questions" ON questions FOR SELECT USING (true);
CREATE POLICY "public_read_responses" ON student_responses FOR SELECT USING (true);
CREATE POLICY "public_read_settings" ON exam_settings FOR SELECT USING (true);

CREATE POLICY "admin_all_students" ON students
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_questions" ON questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_responses" ON student_responses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_settings" ON exam_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_students_stt ON students(stt);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_questions_qid ON questions(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_stt ON student_responses(student_stt);
CREATE INDEX IF NOT EXISTS idx_students_exam_type ON students(exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_responses_exam_type ON student_responses(exam_type);

-- =====================================================
-- Seed default exam settings
-- =====================================================
INSERT INTO exam_settings (key, value) VALUES 
  ('exam_name', 'Kì Thi Khảo Sát Năng Lực'),
  ('show_tv', 'true'),
  ('show_ta', 'true'),
  ('show_toan', 'true'),
  ('show_tdkh', 'true')
ON CONFLICT (key) DO NOTHING;
