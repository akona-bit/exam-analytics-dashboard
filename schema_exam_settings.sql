-- =====================================================
-- Exam Settings — Chạy file này trên Supabase SQL Editor
-- Tạo bảng exam_settings để lưu tên kì thi
-- =====================================================

-- 1. Tạo bảng
CREATE TABLE IF NOT EXISTS exam_settings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bật RLS
ALTER TABLE exam_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Ai cũng đọc được (dashboard public)
CREATE POLICY "public_read_settings" ON exam_settings
  FOR SELECT USING (true);

-- 4. Policy: Admin (đã đăng nhập) được toàn quyền
CREATE POLICY "admin_all_settings" ON exam_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Dữ liệu mặc định
INSERT INTO exam_settings (key, value)
VALUES ('exam_name', 'Kì Thi Khảo Sát Toán & TDKH')
ON CONFLICT (key) DO NOTHING;
