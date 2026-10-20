export type MetricKey = 'tho' | 'irt' | 'vnno1';
export type SubjectKey = 'tv' | 'ta' | 'toan' | 'tdkh';

export interface QuestionData {
  id: string;
  subject: string;
  totalAttempts: number | null;
  correct: number | null;
  incorrect: number | null;
  /** Độ khó IRT (b) — sheet "Thông số câu hỏi" của `tonghop.xlsx`. Càng lớn càng khó. */
  difficulty: number | null;
  /** Độ phân biệt IRT (a) — sheet "Thông số câu hỏi" của `tonghop.xlsx`. Càng lớn càng phân hoá tốt. */
  discrimination: number | null;
  isError?: boolean;
  /** Tỷ lệ làm đúng toàn khóa (%) từ sheet "Thông số câu hỏi" */
  pct?: number | null;
  /** Vị trí câu hỏi tham chiếu trong 6 mã đề (167, 204, 361, 477, 516, 642) */
  codePositions?: Record<string, number>;
  /** D-index (độ phân biệt CTT, nhóm 27%) — từ file dashboard tham chiếu. */
  dIndex?: number | null;
  /** Infit mean-square — mức độ phù hợp mô hình IRT. */
  infit?: number | null;
  /** Outfit mean-square — mức độ phù hợp mô hình IRT. */
  outfit?: number | null;
  /** Điểm quan sát trên đường cong ICC: [theta, tỷ lệ đúng]. */
  obs?: [number, number][];
  /** Nhóm kiến thức lớn (vd. "Tri thức ngữ văn"). */
  groupName?: string;
  /** Chuyên đề kiến thức chi tiết. */
  topicName?: string;
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
  /** Điểm quy đổi theo đề VNNo1 27/1 (ĐGNL ĐHQG TP.HCM) */
  vnno1?: {
    tho: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
    irt: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
    totalCorrect: number | null;
    totalPoints: number | null;
  };
  /** Năng lực theta từng phần thi (thang IRT, dùng cho TCC/KDE). */
  theta?: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
}
