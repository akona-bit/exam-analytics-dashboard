import { ExamType, MetricKey, StudentData, SubjectKey } from './types';

export const EXAM_TYPES: ExamType[] = ['survey', 'mock'];

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  survey: 'Kì Thi Khảo Sát',
  mock: 'Kì Thi Thử',
};

export const normalizeExamType = (v: unknown): ExamType => {
  const raw = String(v ?? '').trim().toLowerCase();
  return raw === 'mock' || raw === 'thi_thu' || raw === 'thu' || raw === 'kì thi thử' ? 'mock' : 'survey';
};

export const examTypeOf = (row: { examType?: ExamType }): ExamType => normalizeExamType(row.examType);

export const filterByExamType = <T extends { examType?: ExamType }>(rows: T[], type: ExamType): T[] =>
  rows.filter(r => examTypeOf(r) === type);

export const countByExamType = <T extends { examType?: ExamType }>(rows: T[]): Record<ExamType, number> => {
  const counts: Record<ExamType, number> = { survey: 0, mock: 0 };
  for (const r of rows) counts[examTypeOf(r)] += 1;
  return counts;
};

export const METRIC_LABEL: Record<MetricKey, string> = {
  tho: 'Điểm Thô',
  irt: 'Điểm IRT',
  thuongPhat: 'Thưởng Phạt',
};

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  toan: 'Toán',
  tdkh: 'TDKH',
};

export const MAX_SUBJECT_SCORE = 25;
export const MAX_TOTAL_SCORE = 50;

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

export const ABILITY_BANDS: AbilityBand[] = [
  { label: 'Yếu · 0–20%', short: 'Yếu', color: '#f43f5e', min: 0, max: 10 },
  { label: 'Trung bình · 20–40%', short: 'Trung bình', color: '#f59e0b', min: 10, max: 20 },
  { label: 'Khá · 40–60%', short: 'Khá', color: '#0ea5e9', min: 20, max: 30 },
  { label: 'Giỏi · 60–80%', short: 'Giỏi', color: '#6366f1', min: 30, max: 40 },
  { label: 'Xuất sắc · 80–100%', short: 'Xuất sắc', color: '#10b981', min: 40, max: Infinity },
];

export const bandOf = (total: number): number =>
  ABILITY_BANDS.findIndex(b => total >= b.min && total < b.max);

export interface ThresholdRow {
  name: string;
  count: number;
  percent: number;
}

export const THRESHOLDS = [20, 25, 30, 35, 40];

export const thresholdRows = (students: StudentData[], metric: MetricKey): ThresholdRow[] =>
  THRESHOLDS.map(t => {
    const count = students.filter(s => totalScore(s, metric) >= t).length;
    return {
      name: `≥ ${t}đ ${Math.round((t / MAX_TOTAL_SCORE) * 100)}%`,
      count,
      percent: students.length ? (count / students.length) * 100 : 0,
    };
  });

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
