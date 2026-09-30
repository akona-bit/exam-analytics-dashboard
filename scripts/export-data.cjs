const fs = require('fs');
const path = require('path');

function parseCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

const readLines = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf-8')
  .split('\n').map(l => l.trim()).filter(l => l);

function loadStudents() {
  const rows = [];
  const lines = readLines('raw_students.csv').slice(2);
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length >= 8) {
      rows.push({
        stt: parseInt(parts[0], 10),
        name: parts[2] || parts[1],
        email: parts[3] || null,
        tho_toan: parseFloat(parts[4]),
        tho_tdkh: parseFloat(parts[5]),
        irt_toan: parseFloat(parts[6]),
        irt_tdkh: parseFloat(parts[7]),
        thuong_phat_toan: parseFloat(parts[8]),
        thuong_phat_tdkh: parseFloat(parts[9]),
        note: '',
      });
    }
  }
  return rows;
}

function loadResponses(students) {
  const responses = [];
  const lines = readLines('raw_student_responses.csv').slice(1);
  let stt = 1;

  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length < 74) continue;

    let name = parts[0] || parts[1];
    let email = parts[3] || parts[9] || null;
    let qStartIdx = 14;

    const checkIdx = parts.findIndex(p => p && p.trim().toUpperCase() === 'TRUE');
    if (checkIdx !== -1) {
      name = parts[checkIdx - 10] || parts[checkIdx - 11];
      email = parts[checkIdx - 8] || parts[checkIdx - 2] || null;
      qStartIdx = checkIdx + 3;
    } else {
      const firstContentIdx = parts.findIndex(p => p && p.trim().length > 0);
      if (firstContentIdx > 0 && firstContentIdx <= 6) {
        name = parts[firstContentIdx] || parts[firstContentIdx + 1];
        qStartIdx = firstContentIdx + 14;
      }
    }

    if (!name) continue;

    if (email) {
      const exact = students.find(s => s.name === name && s.stt === stt);
      if (exact) exact.email = email;
      else {
        const any = students.find(s => s.name === name);
        if (any && !any.email) any.email = email;
      }
    }

    for (let i = 0; i < 60; i++) {
      let val = parts[qStartIdx + i];
      if (val) val = val.trim();
      let status = 'wrong';

      if (val === '1' || val === '1.0' || val === '1.00' || val === '0.1' || val === '0.25' || val === '0.5') {
        status = 'correct';
      } else if (val === '0' || val === '0.0' || val === '0.00') {
        status = 'wrong';
      } else if (val === '' || val === '-1' || val === '\r' || val === '\r\n' || !val) {
        status = 'missing';
      } else {
        const numVal = parseFloat(val);
        if (numVal > 0) status = 'correct';
        else if (numVal === 0) status = 'wrong';
        else status = 'missing';
      }

      if (i + 1 === 4) status = 'correct';

      responses.push({ student_name: name, stt, question_num: i + 1, status });
    }
    stt++;
  }
  return responses;
}

function loadQuestions() {
  const rows = [];
  const lines = readLines('questions.csv').slice(2);
  let currentPhanThi = '';

  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length >= 11) {
      if (parts[0]) currentPhanThi = parts[0];
      const num = (v) => (v ? parseFloat(v) : null);
      const int = (v) => (v ? parseInt(v, 10) : null);
      rows.push({
        phan_thi: currentPhanThi,
        cau_hoi: parts[1],
        hs_da_lam: int(parts[2]),
        hs_lam_dung: int(parts[3]),
        hs_lam_sai: int(parts[4]),
        diem_phat: num(parts[5]),
        diem_thuong_1_y: num(parts[6]),
        diem_thuong_2_y: num(parts[7]),
        diem_thuong_3_y: num(parts[8]),
        diem_thuong_dung: num(parts[9]),
        isError: parts[2] === 'LỖI ĐỀ THI' || parts[1] === 'Câu 4',
      });
    }
  }
  return rows;
}

const students = loadStudents();
const responses = loadResponses(students);
const questions = loadQuestions();

const failed = new Map();
for (const r of responses) {
  if (r.status === 'correct') continue;
  if (!failed.has(r.stt)) failed.set(r.stt, []);
  failed.get(r.stt).push({ question_num: r.question_num, status: r.status });
}

const studentsJson = [...students].sort((a, b) => a.stt - b.stt).map(s => ({
  stt: s.stt,
  name: s.name,
  email: s.email,
  tho: { toan: s.tho_toan, tdkh: s.tho_tdkh },
  irt: { toan: s.irt_toan, tdkh: s.irt_tdkh },
  thuongPhat: { toan: s.thuong_phat_toan, tdkh: s.thuong_phat_tdkh },
  note: s.note,
  responses: failed.get(s.stt) || [],
}));

const questionsJson = questions.map(q => ({
  id: q.cau_hoi,
  subject: q.phan_thi,
  totalAttempts: q.hs_da_lam,
  correct: q.hs_lam_dung,
  incorrect: q.hs_lam_sai,
  penaltyScore: q.diem_phat,
  bonus1: q.diem_thuong_1_y,
  bonus2: q.diem_thuong_2_y,
  bonus3: q.diem_thuong_3_y,
  bonusCorrect: q.diem_thuong_dung,
  isError: q.isError,
}));

const outDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'students.json'), JSON.stringify(studentsJson));
fs.writeFileSync(path.join(outDir, 'questions.json'), JSON.stringify(questionsJson));

const kb = (f) => Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
console.log(`Exported ${studentsJson.length} students (${kb('students.json')} KB), ${questionsJson.length} questions (${kb('questions.json')} KB) -> public/data/`);
