/**
 * Nạp dữ liệu CSV từ thư mục gốc vào Supabase.
 *
 * Đây là bản script hoá đúng những gì trang `#admin` làm khi bạn bấm nút upload,
 * chạy được ngoài trình duyệt để nạp lần đầu hoặc khôi phục dữ liệu.
 *
 * Dùng chung `lib/csvParser.ts` với `server.ts` và `scripts/export-data.ts`, nên
 * dữ liệu nạp vào DB luôn khớp với dữ liệu xuất ra `public/data/*.json`.
 *
 * ── Cách chạy ──────────────────────────────────────────────────────────────
 *   npm run import:supabase -- --type=survey
 *
 * Credential đọc từ biến môi trường, KHÔNG ghi vào repo:
 *   SUPABASE_URL              (mặc định lấy VITE_SUPABASE_URL trong .env)
 *   SUPABASE_ANON_KEY         (mặc định lấy VITE_SUPABASE_ANON_KEY trong .env)
 *   SUPABASE_SERVICE_ROLE_KEY nếu có → bỏ qua RLS, không cần đăng nhập
 *   SUPABASE_EMAIL + SUPABASE_PASSWORD  nếu không có service role key
 *
 * ── Cờ an toàn ─────────────────────────────────────────────────────────────
 *   --dry-run    chỉ đọc và in ra số liệu, KHÔNG ghi gì
 *   --no-delete  không xoá dữ liệu cũ của exam type (mặc định có xoá)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  parseStudentsCsv,
  parseResponsesCsv,
  parseQuestionsCsv,
  failedOnly,
  type ExamType,
} from '../lib/csvParser.js';

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.some(a => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name: string, fallback?: string) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const dryRun = flag('dry-run');
const allowDelete = !flag('no-delete');
const examType = (value('type', 'survey') as ExamType) === 'mock' ? 'mock' : 'survey';

/** .env chỉ chứa biến VITE_*; đọc thẳng để script Node không cần dotenv. */
function readEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const envFile = readEnvFile();
const url = process.env.SUPABASE_URL || envFile.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || envFile.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPABASE_EMAIL;
const password = process.env.SUPABASE_PASSWORD;

if (!url || (!anonKey && !serviceRoleKey)) {
  console.error('Thiếu cấu hình. Cần SUPABASE_URL và (SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey || anonKey, {
  auth: { persistSession: false },
});

const readCsv = (name: string): string => fs.readFileSync(path.join(root, name), 'utf-8');

const students = parseStudentsCsv(readCsv('raw_students.csv'));
const responses = failedOnly(parseResponsesCsv(readCsv('raw_student_responses.csv'), students));
const questions = parseQuestionsCsv(readCsv('questions.csv'));

const withType = (rows: unknown[]) => rows.map(r => ({ ...(r as object), exam_type: examType }));

console.log(`Đọc từ CSV: ${students.length} học sinh · ${questions.length} câu hỏi · ${responses.length} câu sai/bỏ trống`);
console.log(`Exam type: ${examType}`);

if (dryRun) {
  console.log('\n--dry-run: KHÔNG ghi gì vào database.');
  process.exit(0);
}

// ── Đăng nhập ──────────────────────────────────────────────────────────────
if (!serviceRoleKey) {
  if (!email || !password) {
    console.error('\nThiếu credential. Cần một trong hai:');
    console.error('  • SUPABASE_SERVICE_ROLE_KEY  (Supabase > Settings > API > service_role)');
    console.error('  • hoặc SUPABASE_EMAIL + SUPABASE_PASSWORD cho tài khoản admin');
    process.exit(1);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Đăng nhập thất bại:', error.message);
    process.exit(1);
  }
  console.log(`Đã đăng nhập: ${email}`);
}

// ── Ghi dữ liệu ────────────────────────────────────────────────────────────
/** Insert theo lô để không vượt giới hạn số dòng của PostgREST. */
async function insertChunked(table: string, rows: unknown[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${table} lô ${i / chunkSize}: ${error.message}`);
    console.log(`  ${table}: ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }
}

for (const [table, rows] of [
  ['students', students],
  ['questions', questions],
  ['student_responses', responses],
] as const) {
  if (allowDelete) {
    const { error } = await supabase.from(table).delete().eq('exam_type', examType);
    if (error) throw new Error(`xoá ${table}: ${error.message}`);
    console.log(`Đã xoá ${table} cũ của exam_type="${examType}"`);
  }
  await insertChunked(table, withType(rows));
  console.log(`✓ ${table}: ${rows.length} dòng`);
}

console.log(`\nXong. Kiểm tra lại trang tra cứu.`);