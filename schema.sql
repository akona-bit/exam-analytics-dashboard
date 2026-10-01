-- =====================================================
-- Exam Analytics Dashboard — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- =====================================================

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stt         INTEGER NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  tho_toan    FLOAT,
  tho_tdkh    FLOAT,
  irt_toan    FLOAT,
  irt_tdkh    FLOAT,
  tp_toan     FLOAT,
  tp_tdkh     FLOAT,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id     TEXT NOT NULL,
  subject         TEXT NOT NULL,
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
-- RLS Policies — allow all (admin manages data)
-- =====================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_settings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read (the public dashboard needs to fetch data)
CREATE POLICY "public_read_students" ON students FOR SELECT USING (true);
CREATE POLICY "public_read_questions" ON questions FOR SELECT USING (true);
CREATE POLICY "public_read_responses" ON student_responses FOR SELECT USING (true);
CREATE POLICY "public_read_settings" ON exam_settings FOR SELECT USING (true);

-- Allow authenticated users (admins) to do everything
CREATE POLICY "admin_all_students" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_responses" ON student_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_settings" ON exam_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_students_stt ON students(stt);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_questions_qid ON questions(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_stt ON student_responses(student_stt);

-- =====================================================
-- Seed default exam settings
-- =====================================================
INSERT INTO exam_settings (key, value) VALUES ('exam_name', 'Kì Thi Khảo Sát Toán & TDKH')
ON CONFLICT (key) DO NOTHING;
