/**
 * Build-time data exporter: đọc 3 file CSV ở thư mục gốc rồi ghi ra
 * `public/data/students.json` + `public/data/questions.json`.
 *
 * Nhờ vậy bản deploy tĩnh (Cloudflare Pages / GitHub Pages) không cần Express —
 * `App.tsx` tự fallback sang các file JSON này khi không gọi được `/api/*`.
 *
 * Chạy bằng `npm run export-data` (đóng gói qua esbuild rồi chạy bằng Node thuần,
 * không cần Bun/tsx).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseStudentsCsv,
  parseResponsesCsv,
  parseQuestionsCsv,
} from '../src/lib/csvParser.js';

const root = process.cwd();

const CSV_FILES = ['raw_students.csv', 'raw_student_responses.csv', 'questions.csv'] as const;

const missing = CSV_FILES.filter(name => !fs.existsSync(path.join(root, name)));
if (missing.length > 0) {
  // CI và clone mới không có CSV thi (chúng bị gitignore vì chứa SBD/điểm gốc).
  // Đây chỉ là bản export tĩnh dự phòng — `App.tsx` ưu tiên Supabase, nên bỏ qua
  // thay vì làm hỏng cả `npm run build:static`.
  console.warn(
    `export-data: bỏ qua, thiếu ${missing.join(', ')}. ` +
      `Bản build sẽ lấy dữ liệu từ Supabase lúc chạy.`
  );
  process.exit(0);
}

const readCsv = (name: string): string => fs.readFileSync(path.join(root, name), 'utf-8');

const students = parseStudentsCsv(readCsv('raw_students.csv'));
const responses = parseResponsesCsv(readCsv('raw_student_responses.csv'), students);
const questions = parseQuestionsCsv(readCsv('questions.csv'));

/**
 * Gom phản hồi theo STT — giữ **đủ 120 câu** (kể cả câu đúng) để giao diện có thể
 * dựng bảng trạng thái toàn bộ đề. `csvParser` đã bảo đảm mỗi thí sinh có đúng
 * 120 dòng theo thứ tự đề gốc.
 */
const responsesByStt = new Map<number, { question_num: number; status: string }[]>();
for (const r of responses) {
  let list = responsesByStt.get(r.student_stt);
  if (!list) {
    list = [];
    responsesByStt.set(r.student_stt, list);
  }
  list.push({ question_num: r.question_num, status: r.status });
}

const studentsJson = [...students]
  .sort((a, b) => a.stt - b.stt)
  .map(s => ({
    stt: s.stt,
    sbd: s.sbd,
    name: s.name,
    email: s.email,
    gender: s.gender,
    maDe: s.ma_de,
    tho: { tv: s.tho_tv, ta: s.tho_ta, toan: s.tho_toan, tdkh: s.tho_tdkh },
    irt: { tv: s.irt_tv, ta: s.irt_ta, toan: s.irt_toan, tdkh: s.irt_tdkh },
    note: s.note,
    responses: responsesByStt.get(s.stt) || [],
  }));

const questionsJson = questions.map(q => ({
  id: q.question_id,
  subject: q.subject,
  totalAttempts: q.total_attempts,
  correct: q.correct,
  incorrect: q.incorrect,
  penaltyScore: q.penalty_score,
  bonus1: q.bonus1,
  bonus2: q.bonus2,
  bonus3: q.bonus3,
  bonusCorrect: q.bonus_correct,
  isError: q.is_error,
}));

const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'students.json'), JSON.stringify(studentsJson));
fs.writeFileSync(path.join(outDir, 'questions.json'), JSON.stringify(questionsJson));

const kb = (f: string) => Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
console.log(
  `Exported ${studentsJson.length} students (${kb('students.json')} KB), ` +
  `${questionsJson.length} questions (${kb('questions.json')} KB) -> public/data/`
);