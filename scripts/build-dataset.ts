/**
 * Sinh bộ dữ liệu chuẩn từ `tonghop.xlsx` + `Ma trận đặc tả ĐGNL - Nhóm kiến thức.csv`.
 *
 *   tonghop.xlsx
 *     Info            SBD · Email · Họ tên · Giới tính · Mã đề
 *     Main result     Hạng · [Số câu đúng, Điểm] × 4 môn · Tổng
 *     TV_X/TA_X/TO_X/KH_X   625 × 120 ô, giá trị 1 (đúng) / 0 (sai) / -1 (bỏ trống),
 *                            đã ở thứ tự câu của ĐỀ GỐC nên không cần bảng tra mã đề.
 *                            Mỗi sheet còn có 3 cột điểm cuối hàng: Raw (số câu đúng,
 *                            trùng Main result), Theta (năng lực logit thô — GIỮ LẠI
 *                            để dashboard hiển thị) và True (điểm quy đổi, trùng
 *                            Main result).
 *     Thông số câu hỏi % đúng · độ phân biệt (a) · độ khó (b) · vị trí theo 6 mã đề
 *
 *   Ma trận đặc tả ... .csv   Gom nhóm · Kiến thức · số câu  (tổng đúng 120 câu)
 *
 * Xuất ra 3 file CSV ở thư mục gốc; `npm run export-data` đọc chúng qua
 * `lib/csvParser.ts` để ghi `public/data/*.json` — không viết JSON ở đây.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const root = process.cwd();
const EXCEL_FILE = 'tonghop.xlsx';
const MATRIX_FILE = 'Ma trận đặc tả ĐGNL - Nhóm kiến thức.csv';

/** Thứ tự 4 môn: đề gốc câu 1–30, 31–60, 61–90, 91–120. */
const SUBJECTS = [
  { key: 'tv', sheet: 'TV_X', offset: 0, name: 'Tiếng Việt', code: 'TV' },
  { key: 'ta', sheet: 'TA_X', offset: 30, name: 'Tiếng Anh', code: 'TA' },
  { key: 'toan', sheet: 'TO_X', offset: 60, name: 'Toán', code: 'TO' },
  { key: 'tdkh', sheet: 'KH_X', offset: 90, name: 'Tư duy khoa học', code: 'TDKH' },
] as const;

const QUESTIONS_PER_SUBJECT = 30;
const QUESTIONS_TOTAL = QUESTIONS_PER_SUBJECT * SUBJECTS.length;

type Cell = string | number | boolean | null | undefined;

function sheetRows(wb: XLSX.WorkBook, name: string): Cell[][] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Thiếu sheet "${name}" trong ${EXCEL_FILE}`);
  return XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
}

const text = (v: Cell): string => (v === null || v === undefined ? '' : String(v).trim());
const numOrNull = (v: Cell): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Ô trả lời: 1 = đúng, 0 = sai, -1 = bỏ trống. */
const answerStatus = (v: Cell): 1 | 0 | -1 => {
  const n = numOrNull(v);
  if (n === null) return -1;
  if (n > 0) return 1;
  if (n === 0) return 0;
  return -1;
};

/* ────────────────────────── 1. Đọc workbook ────────────────────────── */

// Đọc qua Buffer thay vì `XLSX.readFile`: đường dẫn dự án có dấu tiếng Việt và
// `fs.readFileSync` bên trong SheetJS hay ném ENOENT trên Windows.
const wb = XLSX.read(fs.readFileSync(path.join(root, EXCEL_FILE)), { type: 'buffer', cellDates: false });

interface Student {
  stt: number;
  sbd: string;
  name: string;
  email: string;
  gender: string;
  maDe: string;
  rank: number | null;
  /** Điểm chính thức theo `Main result`: [tv, ta, toan, tdkh]. */
  irt: (number | null)[];
  /** Số câu đúng = điểm thô: [tv, ta, toan, tdkh]. */
  tho: (number | null)[];
  totalCorrect: number | null;
  totalPoints: number | null;
  answers: number[]; // 120 phần tử, 1 / 0 / -1
  /**
   * Điểm IRT (theta, logit) từ sheet `TV_X/TA_X/TO_X/KH_X`: [tv, ta, toan, tdkh].
   * Khác với `irt` (điểm `Main result` đã quy thang) — giá trị này là logit thô.
   */
  irtTheta: (number | null)[];
  /** Điểm quy đổi cột `True` của sheet `TV_X/TA_X/TO_X/KH_X`: [tv, ta, toan, tdkh]. */
  irtTrue: (number | null)[];
}

/* ────────────────────────── 2. Hồ sơ thí sinh (Info) ────────────────────────── */

const infoRows = sheetRows(wb, 'Info');
const infoBySbd = new Map<string, { name: string; email: string; gender: string; maDe: string }>();
for (let i = 1; i < infoRows.length; i++) {
  const r = infoRows[i];
  const sbd = text(r[0]);
  if (!sbd) continue;
  infoBySbd.set(sbd, {
    name: text(r[2]),
    email: text(r[1]),
    gender: text(r[3]),
    maDe: text(r[4]).replace(/\D/g, ''),
  });
}

// Main result: 2 dòng header, dữ liệu từ dòng 3.
const mainRows = sheetRows(wb, 'Main result');
/**
 * Điểm X theo SBD: [raw, theta, true] — đọc từ 3 cột cuối của mỗi
 * sheet `TV_X/TA_X/TO_X/KH_X`: [tv, ta, toan, tdkh].
 */
const xScoreBySbd = new Map<string, { theta: (number | null)[]; raw: (number | null)[]; true: (number | null)[] }>();
for (let si = 0; si < SUBJECTS.length; si++) {
  const rows = sheetRows(wb, SUBJECTS[si].sheet);
  const last = rows[0]?.length ?? 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sbd = text(r[0]);
    if (!sbd) continue;
    let entry = xScoreBySbd.get(sbd);
    if (!entry) {
      entry = {
        theta: [null, null, null, null],
        raw: [null, null, null, null],
        true: [null, null, null, null],
      };
      xScoreBySbd.set(sbd, entry);
    }
    entry.raw[si] = numOrNull(r[last - 3]);
    entry.theta[si] = numOrNull(r[last - 2]);
    entry.true[si] = numOrNull(r[last - 1]);
  }
}
const mainBySbd = new Map<string, Omit<Student, 'answers'>>();
for (let i = 2; i < mainRows.length; i++) {
  const r = mainRows[i];
  const sbd = text(r[1]);
  if (!sbd) continue;
  const x = xScoreBySbd.get(sbd);
  mainBySbd.set(sbd, {
    stt: 0,
    sbd,
    name: '',
    email: '',
    gender: '',
    maDe: '',
    rank: numOrNull(r[0]),
    tho: [numOrNull(r[2]), numOrNull(r[4]), numOrNull(r[6]), numOrNull(r[8])],
    irt: [numOrNull(r[3]), numOrNull(r[5]), numOrNull(r[7]), numOrNull(r[9])],
    totalCorrect: numOrNull(r[10]),
    totalPoints: numOrNull(r[11]),
    irtTheta: x?.theta ?? [null, null, null, null],
    irtTrue: x?.true ?? [null, null, null, null],
  });
}

// 4 sheet câu hỏi → mảng 120 đáp án theo thứ tự đề gốc.
const answersBySbd = new Map<string, number[]>();
for (const subj of SUBJECTS) {
  const rows = sheetRows(wb, subj.sheet);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const sbd = text(r[0]);
    if (!sbd) continue;
    let arr = answersBySbd.get(sbd);
    if (!arr) { arr = new Array<number>(QUESTIONS_TOTAL).fill(-1); answersBySbd.set(sbd, arr); }
    for (let q = 0; q < QUESTIONS_PER_SUBJECT; q++) {
      arr[subj.offset + q] = answerStatus(r[q + 1]);
    }
  }
}

// Thông số câu hỏi: 2 dòng header, dữ liệu từ dòng 3.
const specRows = sheetRows(wb, 'Thông số câu hỏi');
interface QuestionSpec {
  qNum: number;
  pct: number | null;
  a: number | null;
  b: number | null;
}
const specs: QuestionSpec[] = [];
for (let i = 2; i < specRows.length; i++) {
  const r = specRows[i];
  const qNum = Number(text(r[1]).replace(/\D/g, ''));
  if (!Number.isFinite(qNum) || qNum < 1 || qNum > QUESTIONS_TOTAL) continue;
  specs.push({ qNum, pct: numOrNull(r[2]), a: numOrNull(r[3]), b: numOrNull(r[4]) });
}
specs.sort((x, y) => x.qNum - y.qNum);

/* ────────────────────────── 2. Ghép lại thành từng thí sinh ────────────────────────── */

const students: Student[] = [];
const missingMain: string[] = [];
const missingAnswers: string[] = [];

for (const [sbd, info] of infoBySbd) {
  const main = mainBySbd.get(sbd);
  const answers = answersBySbd.get(sbd);
  if (!main) { missingMain.push(sbd); continue; }
  if (!answers) { missingAnswers.push(sbd); continue; }
  students.push({ ...main, ...info, answers });
}
students.sort((a, b) => a.sbd.localeCompare(b.sbd));
students.forEach((s, i) => { s.stt = i + 1; });

/* ────────────────────────── 3. Kiểm tra chéo ────────────────────────── */

let mismatch = 0;
const badRows: string[] = [];
for (const s of students) {
  for (const [i, subj] of SUBJECTS.entries()) {
    let correct = 0;
    for (let q = 0; q < QUESTIONS_PER_SUBJECT; q++) if (s.answers[subj.offset + q] === 1) correct++;
    if (s.tho[i] !== correct) {
      mismatch++;
      if (badRows.length < 5) badRows.push(`${s.sbd} ${subj.code}: đếm ${correct} vs Main result ${s.tho[i]}`);
    }
  }
  const sumTho = SUBJECTS.reduce((sum, _, i) => sum + (s.tho[i] ?? 0), 0);
  const sumIrt = SUBJECTS.reduce((sum, _, i) => sum + (s.irt[i] ?? 0), 0);
  if (s.totalCorrect !== sumTho || s.totalPoints !== sumIrt) {
    mismatch++;
    if (badRows.length < 5) badRows.push(`${s.sbd} tổng: ${sumTho}/${sumIrt} vs ${s.totalCorrect}/${s.totalPoints}`);
  }
}

const maDeCount: Record<string, number> = {};
for (const s of students) maDeCount[s.maDe || '?'] = (maDeCount[s.maDe || '?'] || 0) + 1;

console.log(`✔ ${EXCEL_FILE}: ${students.length} thí sinh, ${specs.length} câu hỏi`);
console.log(`  Mã đề: ${Object.entries(maDeCount).map(([k, v]) => `${k}×${v}`).join('  ')}`);
console.log(`  ${mismatch === 0 ? '✔' : '✘'} đối chiếu Main result: ${mismatch} sai khác`);
badRows.forEach(r => console.log('    -', r));
if (missingMain.length) console.log(`  ⚠ ${missingMain.length} SBD không có trong Main result: ${missingMain.slice(0, 5).join(', ')}`);
if (missingAnswers.length) console.log(`  ⚠ ${missingAnswers.length} SBD không có đáp án từng câu: ${missingAnswers.slice(0, 5).join(', ')}`);

const maxIrt = Math.max(...students.flatMap(s => s.irt.map(v => v ?? 0)));
const maxTho = Math.max(...students.flatMap(s => s.tho.map(v => v ?? 0)));
console.log(`  Thang điểm quan sát được: Thô tối đa ${maxTho}/${QUESTIONS_PER_SUBJECT} · IRT tối đa ${maxIrt}`);
console.log(`  Tổng IRT lớn nhất: ${Math.max(...students.map(s => s.totalPoints ?? 0))}`);

if (mismatch > 0) {
  console.error('✘ Dữ liệu câu hỏi không khớp bảng điểm — dừng lại.');
  process.exit(1);
}

/* ────────────────────────── 4. Ma trận kiến thức ────────────────────────── */

const matrixPath = path.join(root, MATRIX_FILE);
let knowledgeCount = 0;
if (fs.existsSync(matrixPath)) {
  const rows = fs.readFileSync(matrixPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  let domain = '';
  for (const line of rows) {
    const cells = line.split(',').map(c => c.trim());
    if (cells[0]) domain = cells[0];
    const count = parseInt(cells[2] || '', 10);
    if (cells[1] && Number.isFinite(count) && count > 0) knowledgeCount += count;
  }
  console.log(`✔ ${MATRIX_FILE}: tổng ${knowledgeCount} câu theo ma trận`);
} else {
  console.warn(`⚠ Không tìm thấy "${MATRIX_FILE}" — sẽ dùng ma trận 120 câu mặc định.`);
}
if (knowledgeCount !== QUESTIONS_TOTAL) {
  console.warn(`⚠ Ma trận kiến thức có ${knowledgeCount} câu, đề thi có ${QUESTIONS_TOTAL}.`);
}

/* ────────────────────────── 5. Ghi CSV ────────────────────────── */

const csvCell = (v: string | number | null): string => {
  if (v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const studentsHeader = [
  'STT', 'sbd', 'name', 'email', 'gender', 'ma_de',
  // 3 cột điểm cuối mỗi sheet `TV_X/TA_X/TO_X/KH_X`
  'raw_tv', 'raw_ta', 'raw_toan', 'raw_tdkh',
  'theta_tv', 'theta_ta', 'theta_toan', 'theta_tdkh',
  'true_tv', 'true_ta', 'true_toan', 'true_tdkh',
  // Dự phòng (hệ thống) / chính thức
  'irt_tv', 'irt_ta', 'irt_toan', 'irt_tdkh',
  'total_correct', 'total_points', 'note',
];
const studentsCsv = [
  studentsHeader.join(','),
  ...students.map(s => [
    s.stt, s.sbd, s.name, s.email, s.gender, s.maDe,
    // Raw: số câu đúng theo Main result
    s.tho[0], s.tho[1], s.tho[2], s.tho[3],
    // Theta: logit thô từ 3 cột cuối sheet
    s.irtTheta[0], s.irtTheta[1], s.irtTheta[2], s.irtTheta[3],
    // True: điểm quay đổi từ cột True của sheet
    s.irtTrue[0], s.irtTrue[1], s.irtTrue[2], s.irtTrue[3],
    // IRT chính thức: điểm Main result thuần (không đổi với bản cũ)
    s.irt[0], s.irt[1], s.irt[2], s.irt[3],
    s.totalCorrect, s.totalPoints,
    `${s.totalCorrect}/${QUESTIONS_TOTAL} câu đúng · ${s.totalPoints} điểm · mã đề ${s.maDe}`,
  ].map(csvCell).join(',')),
].join('\n') + '\n';

const answersHeader = ['SBD', 'name', 'email', 'gender', 'ma_de', ...Array.from({ length: QUESTIONS_TOTAL }, (_, i) => `Câu ${i + 1}`)];
const answersCsv = [
  answersHeader.join(','),
  ...students.map(s => [s.sbd, s.name, s.email, s.gender, s.maDe, ...s.answers].map(csvCell).join(',')),
].join('\n') + '\n';

// Thống kê từng câu đếm trực tiếp từ 4 sheet đáp án.
const subjectOf = (qNum: number) => SUBJECTS[Math.floor((qNum - 1) / QUESTIONS_PER_SUBJECT)];
const qCorrect = new Array<number>(QUESTIONS_TOTAL).fill(0);
const qBlank = new Array<number>(QUESTIONS_TOTAL).fill(0);
for (const s of students) {
  for (let q = 0; q < QUESTIONS_TOTAL; q++) {
    if (s.answers[q] === 1) qCorrect[q]++;
    else if (s.answers[q] === -1) qBlank[q]++;
  }
}
const specByNum = new Map(specs.map(sp => [sp.qNum, sp]));

const questionsCsv = [
  'Phần thi,Câu hỏi (đề gốc),Số HS đã làm,Số HS làm đúng,Số HS làm sai,Độ khó (b),Độ phân biệt (a)',
  ...Array.from({ length: QUESTIONS_TOTAL }, (_, i) => {
    const qNum = i + 1;
    const sp = specByNum.get(qNum);
    const correct = qCorrect[i];
    const incorrect = students.length - correct;
    return [
      subjectOf(qNum).name, `Câu ${qNum}`, students.length, correct, incorrect,
      sp?.b ?? '', sp?.a ?? '',
    ].map(csvCell).join(',');
  }),
].join('\n') + '\n';

fs.writeFileSync(path.join(root, 'raw_students.csv'), studentsCsv, 'utf8');
fs.writeFileSync(path.join(root, 'raw_student_responses.csv'), answersCsv, 'utf8');
fs.writeFileSync(path.join(root, 'questions.csv'), questionsCsv, 'utf8');
console.log('✔ Đã ghi raw_students.csv · raw_student_responses.csv · questions.csv');
