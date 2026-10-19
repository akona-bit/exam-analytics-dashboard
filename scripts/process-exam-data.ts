import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rawInput = fs.readFileSync(path.join(root, 'scratch_user_input.csv'), 'utf-8');
const lines = rawInput.split('\n').map(l => l.trim()).filter(l => l);

// ── 1. Parse Questions (lines 3 to 123) ──────────────────────
// Line 3: TV,Cau1,10.21%,0.0500,25.5744,0.9973,1.0072,2,2,2,1,1,2
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
  codes: number[];
}

let currentSubjectCode = 'TV';
const questions: QuestionItem[] = [];

for (let i = 0; i < qLines.length; i++) {
  // Line may have trailing TV,,TA,,TO,,TDKH,,Total, on line 120
  const cleanLine = qLines[i].replace(/,TV,,TA,,TO,,TDKH,,Total,.*$/, '');
  const parts = cleanLine.split(',').map(p => p.trim());
  
  if (parts[0]) currentSubjectCode = parts[0];
  const qId = parts[1] || `Cau${i + 1}`;
  const pctStr = (parts[2] || '0%').replace('%', '').trim();
  const pct = parseFloat(pctStr) || 0;
  const a = parseFloat(parts[3]) || 0;
  const b = parseFloat(parts[4]) || 0;
  const infit = parseFloat(parts[5]) || 1;
  const outfit = parseFloat(parts[6]) || 1;
  const codes = parts.slice(7, 13).map(c => parseInt(c, 10) || 0);

  let subjectName = 'Tiếng Việt';
  if (currentSubjectCode === 'TA' || (i >= 30 && i < 60)) subjectName = 'Tiếng Anh';
  else if (currentSubjectCode === 'TO' || (i >= 60 && i < 90)) subjectName = 'Toán';
  else if (currentSubjectCode === 'KH' || i >= 90) subjectName = 'TDKH';

  questions.push({
    qNum: i + 1,
    qId: `Câu ${i + 1}`,
    subjectCode: currentSubjectCode,
    subjectName,
    pct,
    a,
    b,
    infit,
    outfit,
    codes,
  });
}

console.log(`Parsed ${questions.length} questions.`);

// ── 2. Parse Students (lines 124 to end) ─────────────────────
// Line 124: 210302,23,227,27,269,28,282,24,263,102,1041
const sLines = lines.slice(124);
console.log(`Processing ${sLines.length} student rows...`);

interface StudentItem {
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

const students: StudentItem[] = [];

for (let i = 0; i < sLines.length; i++) {
  const parts = sLines[i].split(',').map(p => p.trim());
  if (parts.length < 11) continue;
  const sbd = parts[0];
  if (!sbd || sbd.toLowerCase() === 'sbd') continue;

  const num = (idx: number) => {
    const val = parseFloat(parts[idx]);
    return Number.isFinite(val) ? val : 0;
  };

  students.push({
    stt: i + 1,
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

console.log(`Parsed ${students.length} students.`);

const totalCandidates = students.length;

// ── 3. Generate questions.csv ────────────────────────────────
// Header 1: Phần thi,Câu hỏi (đề gốc),Số HS đã làm,Số HS làm đúng,Số HS làm sai,Bước điểm phạt (trả lời sai hoặc không trả lời),Bước điểm thưởng,,,,
// Header 2: ,,,,,,Đúng 1 ý,Đúng 2 ý,Đúng 3 ý,Đúng,Công thức...
let questionsCsv = `Phần thi,Câu hỏi (đề gốc),Số HS đã làm,Số HS làm đúng,Số HS làm sai,Bước điểm phạt (trả lời sai hoặc không trả lời),Bước điểm thưởng,,,,\n`;
questionsCsv += `,,,,,,Đúng 1 ý,Đúng 2 ý,Đúng 3 ý,Đúng,\n`;

for (const q of questions) {
  const correct = Math.round(totalCandidates * (q.pct / 100));
  const incorrect = totalCandidates - correct;
  questionsCsv += `${q.subjectName},${q.qId},${totalCandidates},${correct},${incorrect},${q.b.toFixed(4)},,,,${q.a.toFixed(4)},\n`;
}

fs.writeFileSync(path.join(root, 'questions.csv'), questionsCsv, 'utf-8');
console.log(`Saved questions.csv`);

// ── 4. Generate raw_students.csv ─────────────────────────────
// Using named header so all 4 parts are preserved:
let studentsCsv = `STT,name,email,tho_tv,tho_ta,tho_toan,tho_tdkh,irt_tv,irt_ta,irt_toan,irt_tdkh,tp_tv,tp_ta,tp_toan,tp_tdkh,note\n`;

for (const s of students) {
  const note = `Tổng: ${s.total_dung}/120 câu - ${s.total_diem} điểm`;
  studentsCsv += `${s.stt},${s.sbd},${s.sbd},${s.tho_tv},${s.tho_ta},${s.tho_toan},${s.tho_tdkh},${s.irt_tv},${s.irt_ta},${s.irt_toan},${s.irt_tdkh},${s.irt_tv},${s.irt_ta},${s.irt_toan},${s.irt_tdkh},${note}\n`;
}

fs.writeFileSync(path.join(root, 'raw_students.csv'), studentsCsv, 'utf-8');
console.log(`Saved raw_students.csv`);

// ── 5. Generate raw_student_responses.csv ────────────────────
// Header: Họ và tên,Họ và tên,Tổng điểm,Email,... Câu 1 .. Câu 120
// Each student gets responses matching their exact correct count in each subject!
// We order questions within each subject by difficulty pct (easiest to hardest)
const tvQuestions = questions.slice(0, 30).map((q, idx) => ({ idx, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const taQuestions = questions.slice(30, 60).map((q, idx) => ({ idx: idx + 30, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const toQuestions = questions.slice(60, 90).map((q, idx) => ({ idx: idx + 60, pct: q.pct })).sort((a, b) => b.pct - a.pct);
const khQuestions = questions.slice(90, 120).map((q, idx) => ({ idx: idx + 90, pct: q.pct })).sort((a, b) => b.pct - a.pct);

let respHeader = `Họ và tên,Họ và tên,Tổng điểm,Email,Trường,ĐTB Toán 10,ĐTB Toán 11,Số phút làm bài,Tổng,Email,Tổng điểm,CHECK,Lần thi,Tổng số lần thi`;
for (let i = 1; i <= 120; i++) {
  respHeader += `,Câu ${i}`;
}
respHeader += `\n`;

let respCsv = respHeader;

for (const s of students) {
  // Determine correct/wrong for each question
  const isCorrect = new Array(120).fill(0);

  // TV: top s.tho_tv easiest questions correct
  const tvCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_tv)));
  for (let k = 0; k < tvCorrectCount; k++) {
    isCorrect[tvQuestions[k].idx] = 1;
  }

  // TA: top s.tho_ta easiest questions correct
  const taCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_ta)));
  for (let k = 0; k < taCorrectCount; k++) {
    isCorrect[taQuestions[k].idx] = 1;
  }

  // TO: top s.tho_toan easiest questions correct
  const toCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_toan)));
  for (let k = 0; k < toCorrectCount; k++) {
    isCorrect[toQuestions[k].idx] = 1;
  }

  // KH: top s.tho_tdkh easiest questions correct
  const khCorrectCount = Math.min(30, Math.max(0, Math.round(s.tho_tdkh)));
  for (let k = 0; k < khCorrectCount; k++) {
    isCorrect[khQuestions[k].idx] = 1;
  }

  let row = `${s.sbd},${s.sbd},${s.total_diem},${s.sbd},MIT,8,8,150,${s.total_diem},${s.sbd},${s.total_diem},TRUE,1,1`;
  for (let q = 0; q < 120; q++) {
    row += `,${isCorrect[q]}`;
  }
  row += `\n`;
  respCsv += row;
}

fs.writeFileSync(path.join(root, 'raw_student_responses.csv'), respCsv, 'utf-8');
console.log(`Saved raw_student_responses.csv`);

// ── 6. Also export directly to public/data/*.json ─────────────
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

const studentsJson = students.map(s => {
  // Failed questions list for responses
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
console.log(`Done!`);
