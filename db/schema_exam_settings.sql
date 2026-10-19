-- =====================================================
-- Exam Settings — Tạo bảng exam_settings để lưu cấu hình kì thi
--
-- ⚠️  ĐÃ ĐƯỢC HỢP NHẤT vào schema.sql và schema_migrate.sql.
--     File này chỉ còn lại để tham khảo. Trên database đã có dữ liệu thì dùng
--     `schema_migrate.sql` — chạy lại vô hạn lần, không mất dữ liệu, không lỗi
--     policy trùng. Chỉ dùng file này khi database trống và chưa chạy schema.sql.
--
--     Trước đây file này khai báo policy `FOR ALL TO authenticated USING (true)`,
--     tức BẤT KỲ tài khoản nào đăng ký trong Supabase Auth cũng sửa/xoá được toàn bộ
--     cấu hình kì thi. Đã siết lại theo danh sách email trong public.is_admin().
--
-- Chạy trong Supabase > SQL Editor.
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

-- 3. Danh sách email được quyền ghi (giữ đúng một nguồn với schema.sql / schema_migrate.sql).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'minhducle629@gmail.com'
  ]::text[]);
$$;

-- 4. DROP trước rồi CREATE để chạy lại không báo 42710: policy already exists
DROP POLICY IF EXISTS "public_read_settings" ON exam_settings;
DROP POLICY IF EXISTS "admin_all_settings" ON exam_settings;

-- Đọc: mở cho mọi người — dashboard công khai dùng anon key.
CREATE POLICY "public_read_settings" ON exam_settings
  FOR SELECT USING (true);

-- Ghi / sửa / xoá: chỉ email nằm trong is_admin().
CREATE POLICY "admin_all_settings" ON exam_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Dữ liệu mặc định
INSERT INTO exam_settings (key, value)
VALUES ('exam_name', 'Kì Thi Khảo Sát Toán & TDKH')
ON CONFLICT (key) DO NOTHING;