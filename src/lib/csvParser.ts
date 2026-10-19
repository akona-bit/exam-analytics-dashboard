/**
 * Bộ phân tích CSV dùng chung cho cả ba nơi: Express server (`server/server.ts`),
 * script export tĩnh (`scripts/export-data.ts`) và trang quản trị (`AdminPage.tsx`).
 *
 * Đầu ra của các hàm `parse*Csv` bám theo đúng tên cột trong `db/schema.sql`
 * (`student_stt`, `question_id`, `is_error`) để `AdminPage` insert thẳng
 * vào Supabase. Hai nơi còn lại map sang shape của API.
 *
 * ⚠️ Toàn bộ script này dùng nguyên tắc: KHÔNG dụng tới `fs` hay mạng, chỉ nhận
 * chuỗi CSV và trả về mảng object thuần — nhờ vậy chạy được cả trong trình duyệt.
 *
 * Nguồn dữ liệu gốc do `npm run build:dataset` sinh ra từ `tonghop.xlsx`:
 * mỗi ô trả lời là `1` (đúng) / `0` (sai) / `-1` (bỏ trống).
 */

/** Số câu mỗi thí sinh trong `raw_student_responses.csv` (4 môn × 30 câu). */
export const QUESTIONS_PER_STUDENT = 120;

/** Số cột tối thiểu để một dòng phản hồi là hợp lệ (5 cột thông tin + 120 câu). */
const MIN_RESPONSE_COLUMNS = 5 + QUESTIONS_PER_STUDENT;

export interface ParsedStudent {
  stt: number;
  sbd: string | null;
  name: string;
  email: string | null;
  gender: string | null;
  ma_de: string | null;
  tho_tv: number | null;
  tho_ta: number | null;
  tho_toan: number | null;
  tho_tdkh: number | null;
  irt_tv: number | null;
  irt_ta: number | null;
  irt_toan: number | null;
  irt_tdkh: number | null;
  total_correct: number | null;
  total_points: number | null;
  note: string;
}

export interface ParsedResponse {
  student_stt: number;
  student_sbd: string;
  question_num: number;
  status: 'correct' | 'wrong' | 'missing';
}

export interface ParsedQuestion {
  question_id: string;
  subject: string;
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

/** Chỉ cần SBD + stt để parser phản hồi back-fill thông tin. */
export interface StudentRef {
  sbd?: string | null;
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

/** Tách file CSV thành các dòng không rỗng (tự bỏ BOM). */
export function readCsvLines(text: string): string[] {
  return text.replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(l => l);
}

export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(',', '.');
  if (s === '' || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(val: unknown): number | null {
  const n = parseNumber(val);
  return n === null ? null : Math.round(n);
}

/**
 * Đọc `raw_students.csv` — 1 dòng header, cột đặt tên theo `ParsedStudent`.
 * Dữ liệu do `npm run build:dataset` sinh ra nên không cần nhánh dự đoán vị trí cột.
 */
export function parseStudentsCsv(csv: string): ParsedStudent[] {
  const rows: ParsedStudent[] = [];
  const lines = readCsvLines(csv);
  if (lines.length < 2) return rows;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const idx = (key: string) => headers.indexOf(key);

  let rowCounter = 1;
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 2) continue;

    const name = ((idx('name') !== -1 ? parts[idx('name')] : '') || '').trim();
    const sbd = idx('sbd') !== -1 ? (parts[idx('sbd')] || '').trim() || null : null;
    if (!name && !sbd) continue;
    if (name.toLowerCase() === 'name' || sbd === 'sbd') continue;

    let sttVal = idx('stt') !== -1 ? parseInteger(parts[idx('stt')]) : null;
    if (sttVal === null || sttVal <= 0) sttVal = rowCounter;
    rowCounter = Math.max(rowCounter, sttVal + 1);

    const get = (key: string) => (idx(key) !== -1 ? parseNumber(parts[idx(key)]) : null);
    const textOf = (key: string) => (idx(key) !== -1 ? (parts[idx(key)] || '').trim() || null : null);

    rows.push({
      stt: sttVal,
      sbd,
      name: name || sbd || '',
      email: textOf('email'),
      gender: textOf('gender'),
      ma_de: textOf('ma_de'),
      tho_tv: get('tho_tv'), tho_ta: get('tho_ta'),
      tho_toan: get('tho_toan'), tho_tdkh: get('tho_tdkh'),
      irt_tv: get('irt_tv'), irt_ta: get('irt_ta'),
      irt_toan: get('irt_toan'), irt_tdkh: get('irt_tdkh'),
      total_correct: get('total_correct'),
      total_points: get('total_points'),
      note: textOf('note') ?? '',
    });
  }
  return rows;
}

/** Quy đổi giá trị ô CSV thành trạng thái câu hỏi. `tonghop.xlsx` dùng 1 / 0 / -1. */
export function parseResponseStatus(rawValue: string | undefined): ParsedResponse['status'] {
  const val = rawValue ? rawValue.trim() : '';
  if (val === '' || val === '-1') return 'missing';
  if (val === '1' || val === '1.0' || val === '1.00') return 'correct';
  if (val === '0' || val === '0.0' || val === '0.00') return 'wrong';

  const num = parseNumber(val);
  if (num === null) return 'missing';
  if (num > 0) return 'correct';
  if (num === 0) return 'wrong';
  return 'missing';
}

/**
 * Đọc `raw_student_responses.csv` — 1 dòng header `SBD,name,email,gender,ma_de,Câu 1…Câu 120`,
 * trả về **toàn bộ 120 câu** mỗi thí sinh. Dòng được nối với thí sinh qua `sbd`
 * (không dựa vào thứ tự dòng). Có back-fill `email` khi CSV thiếu.
 */
export function parseResponsesCsv(csv: string, students: StudentRef[]): ParsedResponse[] {
  const responses: ParsedResponse[] = [];
  const lines = readCsvLines(csv);
  if (lines.length < 2) return responses;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const sbdCol = headers.indexOf('sbd');
  const qStart = headers.findIndex(h => /^c(â|à|a)u\s*\d+$/.test(h));
  if (qStart === -1) throw new Error('raw_student_responses.csv: không tìm thấy cột "Câu 1" trong header');

  const sttBySbd = new Map<string, StudentRef>();
  const sttByName = new Map<string, StudentRef>();
  for (const s of students) {
    const sbd = (s.sbd || '').trim();
    if (sbd && !sttBySbd.has(sbd)) sttBySbd.set(sbd, s);
    const name = s.name.trim();
    if (name && !sttByName.has(name)) sttByName.set(name, s);
  }

  const usedStt = new Set<number>();
  let unmatchedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < MIN_RESPONSE_COLUMNS) continue;

    const sbd = (sbdCol !== -1 ? parts[sbdCol] : parts[0] || '').trim();
    if (!sbd) continue;
    const rowName = (parts[1] || '').trim();

    const ref = sttBySbd.get(sbd) ?? sttByName.get(rowName);
    let rowStt: number;
    if (ref && !usedStt.has(ref.stt)) {
      rowStt = ref.stt;
    } else {
      let candidate = 1;
      while (candidate <= students.length && usedStt.has(candidate)) candidate++;
      rowStt = candidate <= students.length ? candidate : usedStt.size + 1;
      if (!ref) unmatchedRows++;
    }
    usedStt.add(rowStt);

    if (ref && !ref.email) {
      const mail = (parts[2] || '').trim();
      if (mail) ref.email = mail;
    }

    for (let q = 0; q < QUESTIONS_PER_STUDENT; q++) {
      responses.push({
        student_stt: rowStt,
        student_sbd: sbd,
        question_num: q + 1,
        status: parseResponseStatus(parts[qStart + q]),
      });
    }
  }

  if (unmatchedRows > 0) {
    console.warn(
      `[csvParser] ${unmatchedRows}/${lines.length - 1} dòng phản hồi không khớp SBD nào trong raw_students.csv — đã gán theo thứ tự dòng.`
    );
  }
  return responses;
}

/**
 * Đọc `questions.csv` (1 hoặc 2 dòng header, dữ liệu từ dòng 2 hoặc 3).
 * Cột 0 là môn và được forward-fill cho các dòng sau để trống.
 */
export function parseQuestionsCsv(csv: string): ParsedQuestion[] {
  const rows: ParsedQuestion[] = [];
  const lines = readCsvLines(csv);
  if (lines.length < 2) return rows;

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
      total_attempts: parseInteger(parts[2]),
      correct: parseInteger(parts[3]),
      incorrect: parseInteger(parts[4]),
      penalty_score: parseNumber(parts[5]),
      bonus1: parseNumber(parts[6]),
      bonus2: parseNumber(parts[7]),
      bonus3: parseNumber(parts[8]),
      bonus_correct: parseNumber(parts[9]),
      is_error: String(parts[2] || '').trim() === 'LỖI ĐỀ THI',
    });
  }
  return rows;
}

/** Chỉ giữ câu sai / bỏ trống — đúng thứ frontend và bảng `student_responses` cần. */
export function failedOnly(responses: ParsedResponse[]): ParsedResponse[] {
  return responses.filter(r => r.status !== 'correct');
}
