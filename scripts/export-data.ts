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
  failedOnly,
} from '../lib/csvParser.js';

const root = process.cwd();

const readCsv = (name: string): string => fs.readFileSync(path.join(root, name), 'utf-8');

const students = parseStudentsCsv(readCsv('raw_students.csv'));
const responses = parseResponsesCsv(readCsv('raw_student_responses.csv'), students);
const questions = parseQuestionsCsv(readCsv('questions.csv'));

/** Gom câu sai/bỏ trống theo STT — frontend chỉ cần những câu này. */
const failedByStt = new Map<number, { question_num: number; status: string }[]>();
for (const r of failedOnly(responses)) {
  let list = failedByStt.get(r.student_stt);
  if (!list) {
    list = [];
    failedByStt.set(r.student_stt, list);
  }
  list.push({ question_num: r.question_num, status: r.status });
}

const studentsJson = [...students]
  .sort((a, b) => a.stt - b.stt)
  .map(s => ({
    stt: s.stt,
    name: s.name,
    email: s.email,
    examType: s.exam_type,
    tho: { toan: s.tho_toan, tdkh: s.tho_tdkh },
    irt: { toan: s.irt_toan, tdkh: s.irt_tdkh },
    thuongPhat: { toan: s.tp_toan, tdkh: s.tp_tdkh },
    note: s.note,
    responses: failedByStt.get(s.stt) || [],
  }));

const questionsJson = questions.map(q => ({
  id: q.question_id,
  subject: q.subject,
  examType: q.exam_type,
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