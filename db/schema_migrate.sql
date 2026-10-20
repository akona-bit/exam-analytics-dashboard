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

-- ── 1b. Cột tham số IRT của bảng questions ──────────────────────────────────
-- Bảng này trước đây có 5 cột penalty_score/bonus1/bonus2/bonus3/bonus_correct,
-- nhưng questions.csv ghi sai nhãn: penalty_score thực chất là Độ khó (b) và
-- bonus_correct thực chất là Độ phân biệt (a) theo sheet "Thông số câu hỏi" của
-- tonghop.xlsx. Đổi tên đúng ý nghĩa, gộp còn 2 cột và bỏ 3 cột luôn rỗng.
-- An toàn vì bảng questions hiện không chứa dòng dữ liệu; chạy lại được.
DO $$
BEGIN
  -- difficulty: rename nếu chưa có, thêm nếu thiếu hẳn, xoá bản trùng.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'questions' AND column_name = 'difficulty') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'questions' AND column_name = 'penalty_score') THEN
      ALTER TABLE questions RENAME COLUMN penalty_score TO difficulty;
    ELSE
      ALTER TABLE questions ADD COLUMN difficulty FLOAT;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'questions' AND column_name = 'penalty_score') THEN
    ALTER TABLE questions DROP COLUMN penalty_score;
  END IF;

  -- discrimination: tương tự với bonus_correct.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'questions' AND column_name = 'discrimination') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'questions' AND column_name = 'bonus_correct') THEN
      ALTER TABLE questions RENAME COLUMN bonus_correct TO discrimination;
    ELSE
      ALTER TABLE questions ADD COLUMN discrimination FLOAT;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'questions' AND column_name = 'bonus_correct') THEN
    ALTER TABLE questions DROP COLUMN bonus_correct;
  END IF;

  -- 3 cột bonus luôn rỗng trong questions.csv → bỏ hẳn.
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'questions' AND column_name = 'bonus1') THEN
    ALTER TABLE questions DROP COLUMN bonus1;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'questions' AND column_name = 'bonus2') THEN
    ALTER TABLE questions DROP COLUMN bonus2;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'questions' AND column_name = 'bonus3') THEN
    ALTER TABLE questions DROP COLUMN bonus3;
  END IF;
END $$;

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

-- Danh sách email được quyền ghi. Sửa ở ĐÂY rồi chạy lại file này.
-- Trước đây policy là `TO authenticated USING (true)`, tức BẤT KỲ tài khoản
-- nào đăng ký trong Supabase Auth cũng xoá sạch được cả 4 bảng.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'minhducle629@gmail.com'
  ]::text[]);
$$;

DROP POLICY IF EXISTS "public_read_students" ON students;
DROP POLICY IF EXISTS "public_read_questions" ON questions;
DROP POLICY IF EXISTS "public_read_responses" ON student_responses;
DROP POLICY IF EXISTS "public_read_settings" ON exam_settings;
DROP POLICY IF EXISTS "admin_all_students" ON students;
DROP POLICY IF EXISTS "admin_all_questions" ON questions;
DROP POLICY IF EXISTS "admin_all_responses" ON student_responses;
DROP POLICY IF EXISTS "admin_all_settings" ON exam_settings;

-- Dashboard công khai đọc bằng anon key, nên phần đọc phải mở.
CREATE POLICY "public_read_students" ON students FOR SELECT USING (true);
CREATE POLICY "public_read_questions" ON questions FOR SELECT USING (true);
CREATE POLICY "public_read_responses" ON student_responses FOR SELECT USING (true);
CREATE POLICY "public_read_settings" ON exam_settings FOR SELECT USING (true);

-- Ghi / sửa / xoá chỉ dành cho email có trong is_admin().
CREATE POLICY "admin_all_students" ON students
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_questions" ON questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_responses" ON student_responses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_settings" ON exam_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ⚠️ Phần ĐỌC vẫn mở cho mọi người, kể cả email của thí sinh trong bảng
-- students. Đó là điều kiện để dashboard chạy không cần backend. Muốn siết
-- nữa thì phải bỏ email khỏi payload mà App.tsx gọi.

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