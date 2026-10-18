-- Kiểm tra database đã đúng chưa — chạy SAU khi schema_migrate.sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('students','questions','student_responses','exam_settings')
ORDER BY table_name, ordinal_position;

-- Danh sách email được phép ghi
SELECT prosrc FROM pg_proc WHERE proname = 'is_admin';

-- Phần đọc vẫn mở cho anonymous (dashboard cần), phần ghi thì không
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT 'students' t, count(*) FROM students
UNION ALL SELECT 'questions', count(*) FROM questions
UNION ALL SELECT 'student_responses', count(*) FROM student_responses
UNION ALL SELECT 'exam_settings', count(*) FROM exam_settings;