export type MetricKey = 'tho' | 'irt';
export type SubjectKey = 'tv' | 'ta' | 'toan' | 'tdkh';

export interface QuestionData {
  id: string;
  subject: string;
  totalAttempts: number | null;
  correct: number | null;
  incorrect: number | null;
  penaltyScore: number | null;
  bonus1: number | null;
  bonus2: number | null;
  bonus3: number | null;
  bonusCorrect: number | null;
  isError?: boolean;
}

export interface StudentData {
  stt: number;
  /** Họ tên thật. Nếu dữ liệu chỉ có SBD thì `name` trùng `sbd`. */
  name: string;
  email?: string;
  /** Số báo danh — dùng làm mật khẩu tra cứu. */
  sbd?: string;
  /** Giới tính, ví dụ `Nam` / `Nữ`. */
  gender?: string;
  /** Mã đề thí sinh làm bài: 167 · 204 · 361 · 477 · 516 · 642. */
  maDe?: string;
  tho: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
  irt: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
  note?: string;
  customDisplayName?: string;
  /**
   * Phản hồi của thí sinh cho **toàn bộ** câu hỏi của đề (mỗi thí sinh một
   * mảng đúng bằng `QUESTIONS_TOTAL`, theo thứ tự đề gốc). `status` là
   * `'correct' | 'wrong' | 'missing'`.
   */
  responses?: { question_num: number; status: string }[];
}
