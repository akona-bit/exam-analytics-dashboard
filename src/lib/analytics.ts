import { MetricKey, QuestionData, StudentData, SubjectKey } from '../types';

/** Trang phục vụ đúng một kỳ thi nên không còn khái niệm "loại kỳ thi". */
export const EXAM_LABEL = 'Kì Thi Thử ĐGNL';

export const METRIC_LABEL: Record<MetricKey, string> = {
  tho: 'Điểm Thô (Số câu đúng 0–120)',
  irt: 'Điểm Chuẩn Hoá MIT (IRT 1200đ)',
  vnno1: 'Quy Đổi VNNo1 27/1 (ĐGNL 1200đ)',
};

export const ALL_SUBJECTS: SubjectKey[] = ['tv', 'ta', 'toan', 'tdkh'];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  tv: 'Tiếng Việt',
  ta: 'Tiếng Anh',
  toan: 'Toán',
  tdkh: 'Tư Duy Khoa Học',
};

export const SUBJECT_SHORT_LABEL: Record<SubjectKey, string> = {
  tv: 'TV',
  ta: 'TA',
  toan: 'Toán',
  tdkh: 'TDKH',
};

export const SUBJECT_COLOR: Record<SubjectKey, string> = {
  tv: '#ec4899',   // Hồng cánh sen
  ta: '#8b5cf6',   // Tím violet
  toan: '#6366f1', // Lam đậm Indigo
  tdkh: '#0ea5e9', // Xanh da trời Sky
};

/** Số câu mỗi môn — đề thi có 4 môn, mỗi môn 30 câu, tổng cộng 120 câu. */
export const QUESTIONS_PER_SUBJECT = 30;
export const SUBJECT_COUNT = 4;
export const QUESTIONS_TOTAL = QUESTIONS_PER_SUBJECT * SUBJECT_COUNT;

/** Thang điểm tối đa của MỘT môn: 30 câu (thô) hoặc 300 điểm (IRT/VNNo1). */
export const METRIC_MAX_SUBJECT: Record<MetricKey, number> = {
  tho: 30,
  irt: 300,
  vnno1: 300,
};

/** Thang điểm tối đa của một môn theo `metric`. */
export const subjectMax = (metric: MetricKey): number => METRIC_MAX_SUBJECT[metric];

/** Tổng toàn bài thi (4 môn): 120 câu đúng (thô) hoặc 1200 điểm (IRT / VNNo1). */
export const totalMax = (metric: MetricKey): number => (metric === 'tho' ? 120 : 1200);

export const MAX_ALL_SUBJECT_SCORE = QUESTIONS_TOTAL;

export const toNumber = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Lấy lần thi mới nhất của từng học sinh (theo email hoặc tên). */
export const latestAttempts = (students: StudentData[]): StudentData[] => {
  const map = new Map<string, StudentData>();
  for (const s of students) {
    const key = s.email || s.name;
    const ex = map.get(key);
    if (!ex || s.stt > ex.stt) map.set(key, s);
  }
  return Array.from(map.values());
};

const subjectFromName = (subject: string): SubjectKey | null => {
  const s = (subject || '').toLowerCase();
  if (s.includes('việt')) return 'tv';
  if (s.includes('anh')) return 'ta';
  if (s.includes('toán')) return 'toan';
  if (s.includes('khoa học') || s.includes('tdkh')) return 'tdkh';
  return null;
};

/**
 * Điền điểm thô (số câu đúng) từ `responses` khi nguồn dữ liệu chỉ có IRT.
 *
 * File JSON tĩnh hiện chỉ xuất `irt_*`, còn `tho_*` bị null. Nếu cứ để nguyên,
 * mọi thí sinh đều "0/30" ở từng môn và xếp hạng thô ai cũng bằng 0. Chỉ điền khi
 * `responses` thực sự chứa **toàn bộ** câu của đề — API chỉ trả câu sai/bỏ trống
 * nên sẽ không bị nhầm là câu đúng.
 */
export const fillMissingRawScores = (
  students: StudentData[],
  questions: QuestionData[],
): StudentData[] => {
  if (!students.length || !questions.length) return students;

  const subjectByQuestion = new Map<number, SubjectKey>();
  for (const q of questions) {
    const n = Number(String(q.id).replace(/\D/g, ''));
    const subject = subjectFromName(q.subject);
    if (n > 0 && subject) subjectByQuestion.set(n, subject);
  }
  if (subjectByQuestion.size === 0) return students;

  return students.map(student => {
    const raw = student.tho || { toan: null, tdkh: null, tv: null, ta: null };
    const needsFallback = ALL_SUBJECTS.some(subject => raw[subject] === null || raw[subject] === undefined);
    if (!needsFallback || !student.responses?.length) return student;
    if (student.responses.length < subjectByQuestion.size) return student;

    const seen = new Set<number>();
    const correct: Record<SubjectKey, number> = { tv: 0, ta: 0, toan: 0, tdkh: 0 };
    for (const response of student.responses) {
      const subject = subjectByQuestion.get(response.question_num);
      if (!subject) continue;
      seen.add(response.question_num);
      if (response.status === 'correct') correct[subject] += 1;
    }

    if (seen.size < subjectByQuestion.size) return student;

    const nextTho = { ...raw };
    for (const subject of ALL_SUBJECTS) {
      if (nextTho[subject] === null || nextTho[subject] === undefined) {
        nextTho[subject] = correct[subject];
      }
    }
    return { ...student, tho: nextTho };
  });
};

export const groupByStudent = (students: StudentData[]): Map<string, StudentData[]> => {
  const g = new Map<string, StudentData[]>();
  for (const s of students) {
    const key = s.email || s.name;
    const arr = g.get(key);
    if (arr) arr.push(s);
    else g.set(key, [s]);
  }
  for (const arr of g.values()) arr.sort((a, b) => a.stt - b.stt);
  return g;
};

export const mean = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

export const subjectScore = (s: StudentData, metric: MetricKey, subject: SubjectKey): number | null => {
  if (metric === 'vnno1') {
    return toNumber(s.vnno1?.irt?.[subject]);
  }
  return toNumber(s[metric]?.[subject]);
};

/**
 * Tổng điểm toàn bài thi (cộng cả 4 môn: Tiếng Việt + Tiếng Anh + Toán + TDKH).
 * Thang Thô: tối đa 120 câu.
 * Thang IRT / VNNo1: tối đa 1200 điểm.
 */
export const totalScore = (s: StudentData, metric: MetricKey): number => {
  if (metric === 'vnno1') {
    if (typeof s.vnno1?.totalPoints === 'number' && Number.isFinite(s.vnno1.totalPoints)) {
      return s.vnno1.totalPoints;
    }
  }
  const tv = subjectScore(s, metric, 'tv') ?? 0;
  const ta = subjectScore(s, metric, 'ta') ?? 0;
  const toan = subjectScore(s, metric, 'toan') ?? 0;
  const tdkh = subjectScore(s, metric, 'tdkh') ?? 0;
  return tv + ta + toan + tdkh;
};

export const sortedScores = (students: StudentData[], metric: MetricKey, subject: SubjectKey): number[] =>
  students.map(s => subjectScore(s, metric, subject)).filter((v): v is number => v !== null).sort((a, b) => a - b);

export const sortedTotalScores = (students: StudentData[], metric: MetricKey): number[] =>
  students.map(s => totalScore(s, metric)).sort((a, b) => a - b);

export interface DistributionStats {
  n: number;
  min: number;
  q1: number;
  med: number;
  q3: number;
  p90: number;
  max: number;
  avg: number;
  std: number;
}

export const describe = (values: number[]): DistributionStats => {
  if (values.length === 0) {
    return { n: 0, min: 0, q1: 0, med: 0, q3: 0, p90: 0, max: 0, avg: 0, std: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    med: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1],
    avg: mean(sorted),
    std: stdDev(sorted),
  };
};

export interface AbilityBand {
  label: string;
  short: string;
  color: string;
  min: number;
  max: number;
}

/**
 * 5 mức xếp loại năng lực chuẩn:
 * - Xuất sắc: ≥ 80% (≥ 96 câu / ≥ 960đ)
 * - Giỏi: 65% – 79.9% (78 – 95 câu / 780 – 959đ)
 * - Khá: 50% – 64.9% (60 – 77 câu / 600 – 779đ)
 * - Trung bình: 35% – 49.9% (42 – 59 câu / 420 – 599đ)
 * - Yếu: < 35% (< 42 câu / < 420đ)
 */
export const abilityBands = (metric: MetricKey): AbilityBand[] => {
  const max = totalMax(metric);
  return [
    { label: `Yếu · <35% (<${Math.round(max * 0.35)}đ)`, short: 'Yếu', color: '#f43f5e', min: 0, max: max * 0.35 },
    { label: `Trung bình · 35–50% (${Math.round(max * 0.35)}–${Math.round(max * 0.5)}đ)`, short: 'Trung bình', color: '#f59e0b', min: max * 0.35, max: max * 0.5 },
    { label: `Khá · 50–65% (${Math.round(max * 0.5)}–${Math.round(max * 0.65)}đ)`, short: 'Khá', color: '#0ea5e9', min: max * 0.5, max: max * 0.65 },
    { label: `Giỏi · 65–80% (${Math.round(max * 0.65)}–${Math.round(max * 0.8)}đ)`, short: 'Giỏi', color: '#6366f1', min: max * 0.65, max: max * 0.8 },
    { label: `Xuất sắc · ≥80% (≥${Math.round(max * 0.8)}đ)`, short: 'Xuất sắc', color: '#10b981', min: max * 0.8, max: Infinity },
  ];
};

export const bandOf = (total: number, metric: MetricKey): number =>
  abilityBands(metric).findIndex(b => total >= b.min && total < b.max);

/** Ngưỡng "Giỏi" tương ứng 65% tổng điểm bài thi 120 câu (78 câu). */
export const GIOI_MIN = MAX_ALL_SUBJECT_SCORE * 0.65;

export interface ThresholdRow {
  name: string;
  count: number;
  percent: number;
}

/**
 * Tỷ lệ đạt các ngưỡng 40–80% theo "điểm đại diện" của từng thí sinh.
 *
 * Điểm đại diện = trung vị 4 môn (thang 0–300 hoặc 0–30), nhân 4 để quy về
 * thang tổng 1200/120. Vì vậy ngưỡng so sánh phải là `subjectMax * p`, KHÔNG
 * phải `totalMax * p`: trung vị 4 môn nằm trên thang một môn, đem so với ngưỡng
 * tổng 1200 sẽ luôn bằng 0 và biểu đồ trống.
 */
export const thresholdRows = (students: StudentData[], metric: MetricKey): ThresholdRow[] => {
  const total = totalMax(metric);
  const perSubject = subjectMax(metric);
  const reps = students
    .map(s => {
      const vals = ALL_SUBJECTS.map(subj => subjectScore(s, metric, subj)).filter((v): v is number => v !== null);
      return vals.length ? describe(vals).med : null;
    })
    .filter((v): v is number => v !== null);
  return [0.4, 0.5, 0.6, 0.7, 0.8].map(p => {
    const thresholdPerSubject = perSubject * p;
    const thresholdTotal = total * p;
    const count = reps.filter(v => v >= thresholdPerSubject).length;
    return {
      name: `≥ ${Math.round(thresholdTotal)}đ (${Math.round(p * 100)}%)`,
      count,
      percent: reps.length ? (count / reps.length) * 100 : 0,
    };
  });
};

/** @deprecated Dùng `thresholdRows` (đã tính theo trung vị).
 * Tỷ lệ thí sinh đạt ngưỡng %, tính trên TRUNG VỊ điểm từng môn:
 * thí sinh "đạt mốc 50%" khi ít nhất một nửa số môn (2/4) có điểm ≥ mốc.
 * Cách này ổn định hơn đếm tổng điểm khi có bài bỏ trống / điểm ngoại lai.
 */
export const thresholdRowsByMedian = thresholdRows;

/** Điểm trung bình cả 4 môn qua từng lần thi. */
export const attemptAverages = (
  students: StudentData[],
  metric: MetricKey
): { name: string; 'Tiếng Việt': number; 'Tiếng Anh': number; 'Toán': number; 'TDKH': number; 'Tổng': number }[] => {
  const groups = groupByStudent(students);
  const acc = new Map<number, { tv: number; ta: number; toan: number; tdkh: number; c: number }>();
  for (const arr of groups.values()) {
    arr.forEach((s, i) => {
      const n = i + 1;
      const d = acc.get(n) || { tv: 0, ta: 0, toan: 0, tdkh: 0, c: 0 };
      const tv = subjectScore(s, metric, 'tv');
      const ta = subjectScore(s, metric, 'ta');
      const toan = subjectScore(s, metric, 'toan');
      const tdkh = subjectScore(s, metric, 'tdkh');
      if (tv !== null) d.tv += tv;
      if (ta !== null) d.ta += ta;
      if (toan !== null) d.toan += toan;
      if (tdkh !== null) d.tdkh += tdkh;
      d.c += 1;
      acc.set(n, d);
    });
  }
  return Array.from(acc.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([n, d]) => {
      const avgTv = d.c ? +(d.tv / d.c).toFixed(2) : 0;
      const avgTa = d.c ? +(d.ta / d.c).toFixed(2) : 0;
      const avgToan = d.c ? +(d.toan / d.c).toFixed(2) : 0;
      const avgTdkh = d.c ? +(d.tdkh / d.c).toFixed(2) : 0;
      return {
        name: `Lần ${n}`,
        'Tiếng Việt': avgTv,
        'Tiếng Anh': avgTa,
        'Toán': avgToan,
        'TDKH': avgTdkh,
        'Tổng': +(avgTv + avgTa + avgToan + avgTdkh).toFixed(2),
      };
    });
};

export const attemptDistribution = (students: StudentData[]): { name: string; value: number }[] => {
  const groups = groupByStudent(students);
  const counts = new Map<number, number>();
  for (const arr of groups.values()) {
    counts.set(arr.length, (counts.get(arr.length) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([n, value]) => ({ name: `${n} lần`, value }));
};

/** Xếp hạng toàn bộ thí sinh theo tổng điểm 4 môn (120 câu / 1200 điểm). */
export const rankList = (students: StudentData[], metric: MetricKey): { student: StudentData; score: number }[] =>
  students
    .map(student => ({ student, score: totalScore(student, metric) }))
    .sort((a, b) => b.score - a.score);
