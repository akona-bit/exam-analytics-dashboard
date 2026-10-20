/**
 * Build-time data exporter: đọc tonghop.xlsx (nếu có) hoặc 3 file CSV ở thư mục gốc
 * rồi ghi ra `public/data/students.json` + `public/data/questions.json`.
 *
 * Bản deploy tĩnh (Cloudflare Pages) tự tải các file JSON này với đầy đủ:
 * - Thông số câu hỏi (độ khó b, độ phân biệt a, % đúng, vị trí theo 6 mã đề).
 * - Điểm quy đổi VNNo1 27/1 của từng thí sinh.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  parseStudentsCsv,
  parseResponsesCsv,
  parseQuestionsCsv,
} from '../src/lib/csvParser.js';

const root = process.cwd();

const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Đọc sheet "Thông số câu hỏi" và "Quy đổi sang VNNo1 27_1" từ tonghop.xlsx nếu có
const EXCEL_PATH = path.join(root, 'tonghop.xlsx');
let qSpecByNum = new Map<number, { pct: number | null; a: number | null; b: number | null; codePositions: Record<string, number> }>();
let vnno1BySbd = new Map<string, {
  tho: { tv: number | null; ta: number | null; toan: number | null; tdkh: number | null };
  irt: { tv: number | null; ta: number | null; toan: number | null; tdkh: number | null };
  totalCorrect: number | null;
  totalPoints: number | null;
}>();

if (fs.existsSync(EXCEL_PATH)) {
  try {
    const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer' });
    
    // 1. Thông số câu hỏi & vị trí tham chiếu 6 mã đề
    if (wb.Sheets['Thông số câu hỏi']) {
      const qRows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Thông số câu hỏi'], { header: 1 });
      const codes = [167, 204, 361, 477, 516, 642];
      for (let i = 2; i < qRows.length; i++) {
        const r = qRows[i];
        if (!r) continue;
        const qNum = Number(String(r[1] || '').replace(/\D/g, ''));
        if (!Number.isFinite(qNum) || qNum < 1 || qNum > 120) continue;
        const codePositions: Record<string, number> = {};
        codes.forEach((c, idx) => {
          const pos = numOrNull(r[5 + idx]);
          if (pos !== null) codePositions[String(c)] = pos;
        });
        qSpecByNum.set(qNum, {
          pct: numOrNull(r[2]),
          a: numOrNull(r[3]),
          b: numOrNull(r[4]),
          codePositions,
        });
      }
    }

    // 2. Điểm quy đổi sang VNNo1 27/1
    if (wb.Sheets['Quy đổi sang VNNo1 27_1']) {
      const vRows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Quy đổi sang VNNo1 27_1'], { header: 1 });
      for (let i = 2; i < vRows.length; i++) {
        const r = vRows[i];
        if (!r) continue;
        const sbd = String(r[0] || '').trim();
        if (!sbd) continue;
        vnno1BySbd.set(sbd, {
          tho: {
            tv: numOrNull(r[1]),
            ta: numOrNull(r[3]),
            toan: numOrNull(r[5]),
            tdkh: numOrNull(r[7]),
          },
          irt: {
            tv: numOrNull(r[2]),
            ta: numOrNull(r[4]),
            toan: numOrNull(r[6]),
            tdkh: numOrNull(r[8]),
          },
          totalCorrect: numOrNull(r[9]),
          totalPoints: numOrNull(r[10]),
        });
      }
    }
  } catch (err) {
    console.warn('Không đọc được trực tiếp từ tonghop.xlsx:', err);
  }
}

const CSV_FILES = ['raw_students.csv', 'raw_student_responses.csv', 'questions.csv'] as const;

const missing = CSV_FILES.filter(name => !fs.existsSync(path.join(root, name)));
if (missing.length > 0) {
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
  .map(s => {
    const sbdKey = String(s.sbd || '').trim();
    return {
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
      vnno1: vnno1BySbd.get(sbdKey) || undefined,
    };
  });

const questionsJson = questions.map((q, idx) => {
  const qNum = idx + 1;
  const sp = qSpecByNum.get(qNum);
  return {
    id: q.question_id,
    subject: q.subject,
    totalAttempts: q.total_attempts,
    correct: q.correct,
    incorrect: q.incorrect,
    difficulty: sp?.b !== undefined && sp?.b !== null ? sp.b : q.difficulty,
    discrimination: sp?.a !== undefined && sp?.a !== null ? sp.a : q.discrimination,
    isError: q.is_error,
    pct: sp?.pct !== undefined && sp?.pct !== null ? sp.pct : (q.total_attempts ? +(q.correct / q.total_attempts).toFixed(4) : null),
    codePositions: sp?.codePositions || {},
  };
});

const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'students.json'), JSON.stringify(studentsJson));
fs.writeFileSync(path.join(outDir, 'questions.json'), JSON.stringify(questionsJson));

const kb = (f: string) => Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
console.log(
  `Exported ${studentsJson.length} students (${kb('students.json')} KB, ${vnno1BySbd.size} có điểm VNNo1), ` +
  `${questionsJson.length} questions (${kb('questions.json')} KB, ${qSpecByNum.size} có mã đề) -> public/data/`
);