/**
 * Bộ phân tích CSV dùng chung cho cả ba nơi: Express server (`server.ts`),
 * script export tĩnh (`scripts/export-data.ts`) và trang quản trị (`AdminPage.tsx`).
 *
 * Đầu ra của các hàm `parse*Csv` bám theo đúng tên cột trong `schema.sql`
 * (`tp_*`, `student_stt`, `question_id`, `is_error`) để `AdminPage` insert thẳng
 * vào Supabase. Hai nơi còn lại map sang shape của API.
 *
 * ⚠️ Toàn bộ script này dùng nguyên tắc: KHÔNG đụng tới `fs` hay mạng, chỉ nhận
 * chuỗi CSV và trả về mảng object thuần — nhờ vậy chạy được cả trong trình duyệt.
 */

export type ExamType = 'survey' | 'mock';

/** Tên cột có thể chứa loại kỳ thi trong CSV. */
export const EXAM_TYPE_HEADERS = ['exam_type', 'examtype', 'loai_ky_thi', 'loai_ki_thi', 'ky_thi'];

/** Câu 4 bị lỗi đề thi nên bị ép cứng là đúng. */
export const FORCED_CORRECT_QUESTION = 4;

/** Số câu mỗi thí sinh trong `raw_student_responses.csv`. */
export const QUESTIONS_PER_STUDENT = 60;

/** Số cột tối thiểu để một dòng phản hồi là hợp lệ. */
const MIN_RESPONSE_COLUMNS = 74;

export interface ParsedStudent {
  stt: number;
  name: string;
  email: string | null;
  tho_tv: number | null;
  tho_ta: number | null;
  tho_toan: number | null;
  tho_tdkh: number | null;
  irt_tv: number | null;
  irt_ta: number | null;
  irt_toan: number | null;
  irt_tdkh: number | null;
  tp_tv: number | null;
  tp_ta: number | null;
  tp_toan: number | null;
  tp_tdkh: number | null;
  note: string;
  exam_type: ExamType;
}

export interface ParsedResponse {
  student_stt: number;
  student_name: string;
  question_num: number;
  status: 'correct' | 'wrong' | 'missing';
}

export interface ParsedQuestion {
  question_id: string;
  subject: string;
  exam_type: ExamType;
  total_attempts: number | null;
  correct: number | null;
  incorrect: number | null;
  penalty_score: number | null;
  bonus1: number | null;
  bonus2: number | null;
  bonus3: number | null;
  bonus_correct: number | null;
  is_error: boolean;
}

/** Chỉ cần tên + stt + email để parser phản hồi back-fill email. */
export interface StudentRef {
  name: string;
  stt: number;
  email?: string | null;
}

/**
 * Tách một dòng CSV, tôn trọng dấu nháy kép và escape `""`.
 */
export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
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

/** Tách file CSV thành các dòng không rỗng. */
export function readCsvLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(l => l);
}

export function normalizeExamType(value: unknown): ExamType {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  return raw === 'mock' || raw === 'thi_thu' || raw === 'thu' || raw === 'kì thi thử' ? 'mock' : 'survey';
}

export function findExamTypeIndex(headers: string[]): number {
  for (const header of EXAM_TYPE_HEADERS) {
    const i = headers.indexOf(header);
    if (i !== -1) return i;
  }
  return -1;
}

export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Đọc `raw_students.csv` (1 hoặc 2 dòng header, dữ liệu từ dòng 2 hoặc dòng 3).
 * Ưu tiên đọc theo tên cột; nếu thiếu cột `tho_toan` (header chỉ ghi "Thô" chung)
 * thì lùi về đọc theo vị trí cố định.
 */
export function parseStudentsCsv(csv: string): ParsedStudent[] {
  const rows: ParsedStudent[] = [];
  const lines = readCsvLines(csv);
  if (lines.length < 2) return rows;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const idx = {
    stt: headers.indexOf('stt'),
    name: headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('id'),
    email: headers.indexOf('email'),
    tho_tv: headers.indexOf('tho_tv'), tho_ta: headers.indexOf('tho_ta'),
    tho_toan: headers.indexOf('tho_toan'), tho_tdkh: headers.indexOf('tho_tdkh'),
    irt_tv: headers.indexOf('irt_tv'), irt_ta: headers.indexOf('irt_ta'),
    irt_toan: headers.indexOf('irt_toan'), irt_tdkh: headers.indexOf('irt_tdkh'),
    tp_tv: headers.indexOf('tp_tv'), tp_ta: headers.indexOf('tp_ta'),
    tp_toan: headers.indexOf('tp_toan'), tp_tdkh: headers.indexOf('tp_tdkh'),
  };
  const usePositional = idx.tho_toan === -1;
  const examIdx = findExamTypeIndex(headers);

  // Kiểm tra dòng 1 có phải là sub-header (ví dụ chứa Toán, TDKH) không
  let startIndex = 1;
  if (lines.length > 2) {
    const line1Lower = lines[1].toLowerCase();
    if (line1Lower.includes('toán') || line1Lower.includes('tdkh') || line1Lower.includes('thô') || line1Lower.includes('irt')) {
      startIndex = 2;
    }
  }

  let rowCounter = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 2) continue;

    const examType = examIdx !== -1 ? normalizeExamType(parts[examIdx]) : 'survey';

    if (usePositional) {
      if (parts.length < 4) continue;
      const rawName = (parts[2] || parts[1] || parts[0] || '').trim();
      if (!rawName || rawName.toLowerCase() === 'họ và tên' || rawName.toLowerCase() === 'name') continue;

      let sttVal = parseInteger(parts[0]);
      if (sttVal === null || sttVal <= 0) {
        sttVal = rowCounter;
      }
      rowCounter = Math.max(rowCounter, sttVal + 1);

      rows.push({
        stt: sttVal,
        name: rawName,
        email: parts[3] ? parts[3].trim() || null : null,
        tho_tv: null, tho_ta: null,
        tho_toan: parseNumber(parts[4]), tho_tdkh: parseNumber(parts[5]),
        irt_tv: null, irt_ta: null,
        irt_toan: parseNumber(parts[6]), irt_tdkh: parseNumber(parts[7]),
        tp_tv: null, tp_ta: null,
        tp_toan: parseNumber(parts[8]), tp_tdkh: parseNumber(parts[9]),
        note: '',
        exam_type: examType,
      });
    } else {
      const rawName = (idx.name !== -1 ? parts[idx.name] : (parts[2] || parts[1] || parts[0])) || '';
      const name = rawName.trim();
      if (!name || name.toLowerCase() === 'họ và tên' || name.toLowerCase() === 'name') continue;

      let sttVal = idx.stt !== -1 ? parseInteger(parts[idx.stt]) : parseInteger(parts[0]);
      if (sttVal === null || sttVal <= 0) {
        sttVal = rowCounter;
      }
      rowCounter = Math.max(rowCounter, sttVal + 1);

      const getVal = (key: number) => (key !== -1 && parts[key] !== undefined) ? parseNumber(parts[key]) : null;
      rows.push({
        stt: sttVal,
        name: name,
        email: idx.email !== -1 && parts[idx.email] ? parts[idx.email].trim() || null : null,
        tho_tv: getVal(idx.tho_tv), tho_ta: getVal(idx.tho_ta),
        tho_toan: getVal(idx.tho_toan), tho_tdkh: getVal(idx.tho_tdkh),
        irt_tv: getVal(idx.irt_tv), irt_ta: getVal(idx.irt_ta),
        irt_toan: getVal(idx.irt_toan), irt_tdkh: getVal(idx.irt_tdkh),
        tp_tv: getVal(idx.tp_tv), tp_ta: getVal(idx.tp_ta),
        tp_toan: getVal(idx.tp_toan), tp_tdkh: getVal(idx.tp_tdkh),
        note: '',
        exam_type: examType,
      });
    }
  }
  return rows;
}

/** Quy đổi giá trị ô CSV thành trạng thái câu hỏi. */
export function parseResponseStatus(rawValue: string | undefined, questionNum: number): ParsedResponse['status'] {
  if (questionNum === FORCED_CORRECT_QUESTION) return 'correct';

  const val = rawValue ? rawValue.trim() : '';
  if (val === '' || val === '-1' || val === '\r' || val === '\r\n') return 'missing';
  if (val === '1' || val === '1.0' || val === '1.00' || val === '0.1' || val === '0.25' || val === '0.5') return 'correct';
  if (val === '0' || val === '0.0' || val === '0.00') return 'wrong';

  const num = parseNumber(val);
  if (num === null) return 'missing';
  if (num > 0) return 'correct';
  if (num === 0) return 'wrong';
  return 'missing';
}

/**
 * Đọc `raw_student_responses.csv` (1 dòng header).
 * Trả về **toàn bộ** 60 câu mỗi thí sinh — nơi gọi tự lọc nếu chỉ cần câu sai.
 * Có back-fill `email` vào mảng `students` khi tìm thấy tên khớp.
 */
export function parseResponsesCsv(csv: string, students: StudentRef[]): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  const lines = readCsvLines(csv).slice(1);
  let stt = 1;

  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length < MIN_RESPONSE_COLUMNS) continue;

    // Vị trí tên/email/câu đầu tiên phải dò vì header có cột trùng nhau.
    let name = (parts[0] || parts[1] || '').trim();
    let email = (parts[3] || parts[9] || '').trim() || null;
    let qStartIdx = 14;

    const checkIdx = parts.findIndex(p => p && p.trim().toUpperCase() === 'TRUE');
    if (checkIdx !== -1) {
      name = (parts[checkIdx - 10] || parts[checkIdx - 11] || '').trim();
      email = (parts[checkIdx - 8] || parts[checkIdx - 2] || '').trim() || null;
      qStartIdx = checkIdx + 3;
    } else {
      const firstContentIdx = parts.findIndex(p => p && p.trim().length > 0);
      if (firstContentIdx > 0 && firstContentIdx <= 6) {
        name = (parts[firstContentIdx] || parts[firstContentIdx + 1] || '').trim();
        qStartIdx = firstContentIdx + 14;
      }
    }

    if (!name || name.toLowerCase() === 'họ và tên') continue;

    if (email) {
      const exact = students.find(s => s.name === name && s.stt === stt);
      if (exact) {
        exact.email = email;
      } else {
        const any = students.find(s => s.name === name);
        if (any && !any.email) any.email = email;
      }
    }

    for (let i = 0; i < QUESTIONS_PER_STUDENT; i++) {
      responses.push({
        student_stt: stt,
        student_name: name,
        question_num: i + 1,
        status: parseResponseStatus(parts[qStartIdx + i], i + 1),
      });
    }
    stt++;
  }
  return responses;
}

/**
 * Đọc `questions.csv` (1 hoặc 2 dòng header, dữ liệu từ dòng 2 hoặc 3).
 * Cột 0 là môn và bị forward-fill cho các dòng sau để trống.
 */
export function parseQuestionsCsv(csv: string): ParsedQuestion[] {
  const rows: ParsedQuestion[] = [];
  const lines = readCsvLines(csv);
  if (lines.length < 2) return rows;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const examIdx = findExamTypeIndex(headers);
  let currentSubject = '';

  const startIndex = lines.length > 2 && (lines[1].toLowerCase().includes('đúng') || lines[1].toLowerCase().includes('công thức')) ? 2 : 1;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 2) continue;
    if (parts[0] && parts[0].trim()) currentSubject = parts[0].trim();

    const qId = (parts[1] || parts[0] || '').trim();
    if (!qId || qId.toLowerCase().includes('câu hỏi') || qId.toLowerCase().includes('question') || qId.toLowerCase() === 'phần thi') continue;

    rows.push({
      question_id: qId,
      subject: currentSubject || 'Toán',
      exam_type: examIdx !== -1 ? normalizeExamType(parts[examIdx]) : 'survey',
      total_attempts: parseInteger(parts[2]),
      correct: parseInteger(parts[3]),
      incorrect: parseInteger(parts[4]),
      penalty_score: parseNumber(parts[5]),
      bonus1: parseNumber(parts[6]),
      bonus2: parseNumber(parts[7]),
      bonus3: parseNumber(parts[8]),
      bonus_correct: parseNumber(parts[9]),
      is_error: String(parts[2] || '').trim() === 'LỖI ĐỀ THI' || qId === 'Câu 4',
    });
  }
  return rows;
}

/** Chỉ giữ câu sai / bỏ trống — đúng thứ frontend và bảng `student_responses` cần. */
export function failedOnly(responses: ParsedResponse[]): ParsedResponse[] {
  return responses.filter(r => r.status !== 'correct');
}