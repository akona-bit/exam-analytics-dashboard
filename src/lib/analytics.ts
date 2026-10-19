import { MetricKey, StudentData, SubjectKey } from '../types';

/** Trang phục vụ đúng một kỳ thi nên không còn khái niệm "loại kỳ thi". */
export const EXAM_LABEL = 'Kì Thi Thử';

export const METRIC_LABEL: Record<MetricKey, string> = {
  tho: 'Điểm Thô',
  irt: 'Điểm Neo Đề',
};

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  toan: 'Toán',
  tdkh: 'TDKH',
};

/** Số câu mỗi môn — đề thi có 4 môn nên tổng cộng 120 câu. */
export const QUESTIONS_PER_SUBJECT = 30;
export const SUBJECT_COUNT = 4;
export const QUESTIONS_TOTAL = QUESTIONS_PER_SUBJECT * SUBJECT_COUNT;

/** Thang điểm tối đa của MỘT môn, khác nhau theo từng thang đo. */
export const METRIC_MAX_SUBJECT: Record<MetricKey, number> = {
  tho: QUESTIONS_PER_SUBJECT, // số câu đúng
  irt: 300,                   // điểm neo đề chuẩn hoá
};

/** Thang điểm tối đa của một môn theo `metric`. */
export const subjectMax = (metric: MetricKey): number => METRIC_MAX_SUBJECT[metric];

/** Tổng Toán + TDKH theo `metric`. */
export const totalMax = (metric: MetricKey): number => METRIC_MAX_SUBJECT[metric] * 2;

/** Tổng đủ 4 môn — chỉ dùng được cho thang `tho`. */
export const MAX_ALL_SUBJECT_SCORE = QUESTIONS_TOTAL;

export const toNumber = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;


export const latestAttempts = (students: StudentData[]): StudentData[] => {
  const map = new Map<string, StudentData>();
  for (const s of students) {
    const key = s.email || s.name;
    const ex = map.get(key);
    if (!ex || s.stt > ex.stt) map.set(key, s);
  }
  return Array.from(map.values());
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

export const subjectScore = (s: StudentData, metric: MetricKey, subject: SubjectKey): number | null =>
  toNumber(s[metric][subject]);

export const totalScore = (s: StudentData, metric: MetricKey): number =>
  (subjectScore(s, metric, 'toan') ?? 0) + (subjectScore(s, metric, 'tdkh') ?? 0);

export const sortedScores = (students: StudentData[], metric: MetricKey, subject: SubjectKey): number[] =>
  students.map(s => subjectScore(s, metric, subject)).filter((v): v is number => v !== null).sort((a, b) => a - b);

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

/** 5 mức xếp loại, ranh giới tính theo % của tổng điểm của `metric`. */
export const abilityBands = (metric: MetricKey): AbilityBand[] => {
  const max = totalMax(metric);
  return [
    { label: 'Yếu · 0–20%', short: 'Yếu', color: '#f43f5e', min: 0, max: max * 0.2 },
    { label: 'Trung bình · 20–40%', short: 'Trung bình', color: '#f59e0b', min: max * 0.2, max: max * 0.4 },
    { label: 'Khá · 40–60%', short: 'Khá', color: '#0ea5e9', min: max * 0.4, max: max * 0.6 },
    { label: 'Giỏi · 60–80%', short: 'Giỏi', color: '#6366f1', min: max * 0.6, max: max * 0.8 },
    { label: 'Xuất sắc · 80–100%', short: 'Xuất sắc', color: '#10b981', min: max * 0.8, max: Infinity },
  ];
};

/** Trả về -1 nếu tổng điểm rơi ngoài mọi mức (ví dụ âm). */
export const bandOf = (total: number, metric: MetricKey): number =>
  abilityBands(metric).findIndex(b => total >= b.min && total < b.max);

/** Ngưỡng "Giỏi" quy đổi từ thang Toán + TDKH sang thang đủ 4 môn, để cùng một tỉ lệ 60% dùng được trên cả hai cách cộng điểm. */
export const GIOI_MIN = MAX_ALL_SUBJECT_SCORE * 0.6;

export interface ThresholdRow {
  name: string;
  count: number;
  percent: number;
}

/** Ngưỡng tương ứng 40 / 50 / 60 / 70 / 80% của tổng điểm `metric`. */
export const thresholdRows = (students: StudentData[], metric: MetricKey): ThresholdRow[] => {
  const max = totalMax(metric);
  return [0.4, 0.5, 0.6, 0.7, 0.8].map(p => {
    const t = max * p;
    const count = students.filter(s => totalScore(s, metric) >= t).length;
    return {
      name: `≥ ${Math.round(t)}đ ${Math.round(p * 100)}%`,
      count,
      percent: students.length ? (count / students.length) * 100 : 0,
    };
  });
};

export const attemptAverages = (students: StudentData[], metric: MetricKey): { name: string; Toán: number; TDKH: number }[] => {
  const groups = groupByStudent(students);
  const acc = new Map<number, { st: number; sd: number; c: number }>();
  for (const arr of groups.values()) {
    arr.forEach((s, i) => {
      const n = i + 1;
      const d = acc.get(n) || { st: 0, sd: 0, c: 0 };
      const toan = subjectScore(s, metric, 'toan');
      const tdkh = subjectScore(s, metric, 'tdkh');
      if (toan !== null) d.st += toan;
      if (tdkh !== null) d.sd += tdkh;
      d.c += 1;
      acc.set(n, d);
    });
  }
  return Array.from(acc.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([n, d]) => ({
      name: `Lần ${n}`,
      'Toán': d.c ? +(d.st / d.c).toFixed(2) : 0,
      'TDKH': d.c ? +(d.sd / d.c).toFixed(2) : 0,
    }));
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

export const rankList = (students: StudentData[], metric: MetricKey): { student: StudentData; score: number }[] =>
  students.map(student => ({ student, score: totalScore(student, metric) })).sort((a, b) => b.score - a.score);
