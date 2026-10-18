-- =====================================================
-- Migration idempotent — đưa một database đang chạy về đúng trạng thái
-- mà schema.sql mô tả, KHÔNG mất dữ liệu và chạy lại được bao nhiêu lần cũng được.
--
-- Dùng file này (không phải schema.sql) khi database đã có bảng và đã có
-- policy. schema.sql chỉ dành cho database trống: CREATE POLICY của
-- PostgreSQL không có IF NOT EXISTS nên chạy lại sẽ báo
--   ERROR 42710: policy "..." already exists
--
-- Chạy trong Supabase > SQL Editor.
-- =====================================================

-- ── 1. Cột còn thiếu ────────────────────────────────────────────────────────
-- exam_type: database có thể chưa chạy schema_exam_type.sql
ALTER TABLE students          ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';
ALTER TABLE questions         ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';
ALTER TABLE student_responses ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'survey';

-- Nhóm điểm Tư duy / Tác phảm: schema gốc đã có, database cũ thì chưa
ALTER TABLE students ADD COLUMN IF NOT EXISTS tho_tv FLOAT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tho_ta FLOAT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS irt_tv FLOAT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS irt_ta FLOAT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tp_tv  FLOAT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tp_ta  FLOAT;

-- Cột thiếu thì có thể đã tồn tại với kiểu khác (ví dụ exam_type do
-- migration cũ tạo). Ép cho khớp để app không gặp ràng buộc lạ.
ALTER TABLE students ALTER COLUMN exam_type SET DEFAULT 'survey';
ALTER TABLE questions ALTER COLUMN exam_type SET DEFAULT 'survey';
ALTER TABLE student_responses ALTER COLUMN exam_type SET DEFAULT 'survey';

-- ── 2. Gán loại kỳ thi cho dữ liệu đang có ──────────────────────────────────
UPDATE students          SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';
UPDATE questions         SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';
UPDATE student_responses SET exam_type = 'survey' WHERE exam_type IS NULL OR exam_type = '';

-- ── 3. Index ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_stt        ON students(stt);
CREATE INDEX IF NOT EXISTS idx_students_name       ON students(name);
CREATE INDEX IF NOT EXISTS idx_questions_qid       ON questions(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_stt       ON student_responses(student_stt);
CREATE INDEX IF NOT EXISTS idx_students_exam_type  ON students(exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_responses_exam_type ON student_responses(exam_type);

-- ── 4. RLS + policy ─────────────────────────────────────────────────────────
-- DROP trước rồi CREATE để chạy lại không báo 42710.
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_settings     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_students" ON students;
DROP POLICY IF EXISTS "public_read_questions" ON questions;
DROP POLICY IF EXISTS "public_read_responses" ON student_responses;
DROP POLICY IF EXISTS "public_read_settings" ON exam_settings;
DROP POLICY IF EXISTS "admin_all_students" ON students;
DROP POLICY IF EXISTS "admin_all_questions" ON questions;
DROP POLICY IF EXISTS "admin_all_responses" ON student_responses;
DROP POLICY IF EXISTS "admin_all_settings" ON exam_settings;

CREATE POLICY "public_read_students" ON students FOR SELECT USING (true);
CREATE POLICY "public_read_questions" ON questions FOR SELECT USING (true);
CREATE POLICY "public_read_responses" ON student_responses FOR SELECT USING (true);
CREATE POLICY "public_read_settings" ON exam_settings FOR SELECT USING (true);

-- ⚠️ Xem ghi chú bảo mật trong README: các policy này cho MỌI user đã đăng ký
-- quyền toàn quyền trên cả 4 bảng. Siết lại trước khi dùng thật.
CREATE POLICY "admin_all_students" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_questions" ON questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_responses" ON student_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_settings" ON exam_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Dữ liệu mặc định ────────────────────────────────────────────────────
INSERT INTO exam_settings (key, value) VALUES
  ('exam_name', 'Kì Thi Khảo Sát Toán & TDKH'),
  ('show_tv', 'true'),
  ('show_ta', 'true'),
  ('show_toan', 'true'),
  ('show_tdkh', 'true')
ON CONFLICT (key) DO NOTHING;

-- ── 6. Xác nhận ─────────────────────────────────────────────────────────────
-- Chạy câu dưới để kiểm tra database đã đúng:
--
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('students','questions','student_responses')
--     AND column_name IN ('exam_type','tho_tv','tho_ta','irt_tv','irt_ta','tp_tv','tp_ta')
--   ORDER BY table_name, column_name;
--
-- Kỳ vọng: exam_type xuất hiện ở cả 3 bảng, và 6 cột tv/ta ở students.