import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// 1. Read question data from scratch_user_input.csv (lines 4 to 123)
const rawInput = fs.readFileSync(path.join(root, 'scratch_user_input.csv'), 'utf-8');
const lines = rawInput.split('\n').map(l => l.trim()).filter(l => l);

const qLines = lines.slice(3, 123);
console.log(`Processing ${qLines.length} questions...`);

interface QuestionItem {
  qNum: number;
  qId: string;
  subjectCode: string;
  subjectName: string;
  pct: number;
  a: number;
  b: number;
  infit: number;
  outfit: number;
  codes: Record<string, number>; // code -> position in that code
}

const EXAM_CODES = ['167', '204', '361', '477', '516', '642'];
let currentSubjectCode = 'TV';
const questions: QuestionItem[] = [];

for (let i = 0; i < qLines.length; i++) {
  const cleanLine = qLines[i].replace(/,TV,,TA,,TO,,TDKH,,Total,.*$/, '');
  const parts = cleanLine.split(',').map(p => p.trim());
  
  if (parts[0]) currentSubjectCode = parts[0];
  const qId = `Câu ${i + 1}`;
  const pctStr = (parts[2] || '0%').replace('%', '').trim();
  const pct = parseFloat(pctStr) || 0;
  const a = parseFloat(parts[3]) || 0;
  const b = parseFloat(parts[4]) || 0;
  const infit = parseFloat(parts[5]) || 1;
  const outfit = parseFloat(parts[6]) || 1;

  const codePositions: Record<string, number> = {};
  for (let cIdx = 0; cIdx < EXAM_CODES.length; cIdx++) {
    const pos = parseInt(parts[7 + cIdx], 10);
    codePositions[EXAM_CODES[cIdx]] = isNaN(pos) ? i + 1 : pos;
  }

  let subjectName = 'Tiếng Việt';
  if (currentSubjectCode === 'TA' || (i >= 30 && i < 60)) subjectName = 'Tiếng Anh';
  else if (currentSubjectCode === 'TO' || (i >= 60 && i < 90)) subjectName = 'Toán';
  else if (currentSubjectCode === 'KH' || i >= 90) subjectName = 'TDKH';

  questions.push({
    qNum: i + 1,
    qId,
    subjectCode: currentSubjectCode,
    subjectName,
    pct,
    a,
    b,
    infit,
    outfit,
    codes: codePositions,
  });
}

console.log(`Parsed ${questions.length} questions.`);

// 2. Read new students scores from new_students_scores.csv
const rawScores = fs.readFileSync(path.join(root, 'new_students_scores.csv'), 'utf-8');
const sLines = rawScores.split('\n').map(l => l.trim()).filter(l => l);

interface StudentScore {
  stt: number;
  sbd: string;
  tho_tv: number;
  irt_tv: number;
  tho_ta: number;
  irt_ta: number;
  tho_toan: number;
  irt_toan: number;
  tho_tdkh: number;
  irt_tdkh: number;
  total_dung: number;
  total_diem: number;
}

const students: StudentScore[] = [];
for (let i = 1; i < sLines.length; i++) {
  const parts = sLines[i].split(',').map(p => p.trim());
  if (parts.length < 11) continue;
  const sbd = parts[0];
  if (!sbd || sbd.toLowerCase() === 'sbd') continue;

  const num = (idx: number) => {
    const val = parseFloat(parts[idx]);
    return Number.isFinite(val) ? val : 0;
  };

  students.push({
    stt: i,
    sbd,
    tho_tv: num(1),
    irt_tv: num(2),
    tho_ta: num(3),
    irt_ta: num(4),
    tho_toan: num(5),
    irt_toan: num(6),
    tho_tdkh: num(7),
    irt_tdkh: num(8),
    total_dung: num(9),
    total_diem: num(10),
  });
}

console.log(`Parsed ${students.length} students from new scores.`);

// 3. Question ordering within each subject by difficulty pct (easiest to hardest)
const tvQuestions = questions.slice(0, 30).map((q, idx) => ({ idx, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const taQuestions = questions.slice(30, 60).map((q, idx) => ({ idx: idx + 30, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const toQuestions = questions.slice(60, 90).map((q, idx) => ({ idx: idx + 60, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const khQuestions = questions.slice(90, 120).map((q, idx) => ({ idx: idx + 90, pct: q.pct })).sort((a, b) => b.pct - a.pct);

// 4. Generate public/data/questions.json
const totalCandidates = students.length;
const questionsJson = questions.map(q => ({
  id: q.qId,
  subject: q.subjectName,
  examType: 'survey',
  totalAttempts: totalCandidates,
  correct: Math.round(totalCandidates * (q.pct / 100)),
  incorrect: totalCandidates - Math.round(totalCandidates * (q.pct / 100)),
  penaltyScore: q.b,
  bonus1: q.a,
  bonus2: null,
  bonus3: null,
  bonusCorrect: null,
  isError: false,
}));

// 5. Generate public/data/students.json
const studentsJson = students.map(s => {
  const tvCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_tv)));
  const taCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_ta)));
  const toCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_toan)));
  const khCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_tdkh)));

  const correctIndices = new Set<number>();
  for (let k = 0; k < tvCorrectCount; k++) correctIndices.add(tvQuestions[k].idx);
  for (let k = 0; k < taCorrectCount; k++) correctIndices.add(taQuestions[k].idx);
  for (let k = 0; k < toCorrectCount; k++) correctIndices.add(toQuestions[k].idx);
  for (let k = 0; k < khCorrectCount; k++) correctIndices.add(khQuestions[k].idx);

  const failedResponses: { question_num: number; status: string }[] = [];
  for (let q = 0; q < 120; q++) {
    if (!correctIndices.has(q)) {
      failedResponses.push({ question_num: q + 1, status: 'wrong' });
    }
  }

  return {
    stt: s.stt,
    name: s.sbd,
    email: s.sbd,
    examType: 'survey',
    tho: { tv: s.tho_tv, ta: s.tho_ta, toan: s.tho_toan, tdkh: s.tho_tdkh },
    irt: { tv: s.irt_tv, ta: s.irt_ta, toan: s.irt_toan, tdkh: s.irt_tdkh },
    thuongPhat: { tv: s.irt_tv, ta: s.irt_ta, toan: s.irt_toan, tdkh: s.irt_tdkh },
    note: `Tổng: ${s.total_dung}/120 câu - ${s.total_diem} điểm`,
    responses: failedResponses,
  };
});

fs.mkdirSync(path.join(root, 'public', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'data', 'questions.json'), JSON.stringify(questionsJson, null, 2), 'utf-8');
fs.writeFileSync(path.join(root, 'public', 'data', 'students.json'), JSON.stringify(studentsJson, null, 2), 'utf-8');
console.log(`Saved public/data/questions.json & students.json`);

// 6. Generate raw_students.csv
let rawStudentsCsv = `STT,name,email,tho_tv,tho_ta,tho_toan,tho_tdkh,irt_tv,irt_ta,irt_toan,irt_tdkh,tp_tv,tp_ta,tp_toan,tp_tdkh,note\n`;
for (const s of students) {
  const note = `Tổng: ${s.total_dung}/120 câu - ${s.total_diem} điểm`;
  rawStudentsCsv += `${s.stt},${s.sbd},${s.sbd},${s.tho_tv},${s.tho_ta},${s.tho_toan},${s.tho_tdkh},${s.irt_tv},${s.irt_ta},${s.irt_toan},${s.irt_tdkh},${s.irt_tv},${s.irt_ta},${s.irt_toan},${s.irt_tdkh},${note}\n`;
}
fs.writeFileSync(path.join(root, 'raw_students.csv'), rawStudentsCsv, 'utf-8');
console.log(`Saved raw_students.csv`);

// 7. Generate questions.csv
let questionsCsv = `Phần thi,Câu hỏi (đề gốc),Số HS đã làm,Số HS làm đúng,Số HS làm sai,Bước điểm phạt (trả lời sai hoặc không trả lời),Bước điểm thưởng,,,,\n`;
questionsCsv += `,,,,,,Đúng 1 ý,Đúng 2 ý,Đúng 3 ý,Đúng,\n`;
for (const q of questions) {
  const correct = Math.round(totalCandidates * (q.pct / 100));
  const incorrect = totalCandidates - correct;
  questionsCsv += `${q.subjectName},${q.qId},${totalCandidates},${correct},${incorrect},${q.b.toFixed(4)},,,,${q.a.toFixed(4)},\n`;
}
fs.writeFileSync(path.join(root, 'questions.csv'), questionsCsv, 'utf-8');
console.log(`Saved questions.csv`);

// 8. Generate src/lib/examCodesMapping.ts
// Maps original question number (1-120) to position in each exam code, and vice versa!
const originalToExamCode: Record<string, Record<number, number>> = {};
const examCodeToOriginal: Record<string, Record<number, number>> = {};

for (const code of EXAM_CODES) {
  originalToExamCode[code] = {};
  examCodeToOriginal[code] = {};
}

for (const q of questions) {
  for (const code of EXAM_CODES) {
    const examPos = q.codes[code] || q.qNum;
    originalToExamCode[code][q.qNum] = examPos;
    examCodeToOriginal[code][examPos] = q.qNum;
  }
}

const examCodesTs = `/**
 * Exam Code (Mã Đề) Question Position Mappings
 * Maps question numbers between original exam (đề gốc) and specific test codes:
 * 167, 204, 361, 477, 516, 642
 */

export const AVAILABLE_EXAM_CODES = ['167', '204', '361', '477', '516', '642'] as const;
export type AvailableExamCode = typeof AVAILABLE_EXAM_CODES[number];

/** Given (examCode, originalQNum), returns position in that exam code (1-120) */
export const ORIGINAL_TO_EXAM_CODE: Record<string, Record<number, number>> = ${JSON.stringify(originalToExamCode, null, 2)};

/** Given (examCode, examQNum), returns original question number (1-120) */
export const EXAM_CODE_TO_ORIGINAL: Record<string, Record<number, number>> = ${JSON.stringify(examCodeToOriginal, null, 2)};

export function getExamCodeQuestionNum(originalQNum: number, examCode?: string | null): number {
  if (!examCode || !ORIGINAL_TO_EXAM_CODE[examCode]) return originalQNum;
  return ORIGINAL_TO_EXAM_CODE[examCode][originalQNum] || originalQNum;
}

export function getOriginalQuestionNum(examQNum: number, examCode?: string | null): number {
  if (!examCode || !EXAM_CODE_TO_ORIGINAL[examCode]) return examQNum;
  return EXAM_CODE_TO_ORIGINAL[examCode][examQNum] || examQNum;
}
`;

fs.writeFileSync(path.join(root, 'src', 'lib', 'examCodesMapping.ts'), examCodesTs, 'utf-8');
console.log(`Saved src/lib/examCodesMapping.ts`);

console.log('Build completed successfully!');
