import React, { useMemo, useState, useEffect } from 'react';
import { MetricKey, QuestionData, StudentData } from '../../types';
import {
  METRIC_LABEL,
  SUBJECT_LABEL,
  SUBJECT_COLOR,
  ALL_SUBJECTS,
  latestAttempts,
  describe,
  sortedScores,
  sortedTotalScores,
  thresholdRows,
  totalScore,
  subjectScore,
  bandOf,
  abilityBands,
  subjectMax,
  totalMax,
  rankList,
  attemptAverages,
  attemptDistribution,
} from '../../lib/analytics';
import { QuestionTable } from './QuestionTable';
import { ItemCurveSection } from './PsychometricInsights';
import { DeepAnalysis } from './DeepAnalysis';
import { AVAILABLE_EXAM_CODES } from '../../lib/examCodesMapping';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LabelList,
} from 'recharts';
import {
  BarChart3,
  Trophy,
  ListFilter,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Activity,
  Award,
  Flame,
  CheckSquare,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  students: StudentData[];
  questions: QuestionData[];
  metric: MetricKey;
  onMetricChange?: (m: MetricKey) => void;
}

/**
 * Tooltip dùng chung cho mọi biểu đồ: chỉ style khung, KHÔNG đặt color/màu nền,
 * để item/tên hiển thị đúng màu series thay vì bị ép về một màu duy nhất.
 */
const tooltipBox = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  fontSize: '13px',
  backgroundColor: '#ffffff',
  padding: '8px 12px',
};

/** Nhãn trục dễ đọc trên nền sáng (thay #94a3b8 quá nhạt). */
const AXIS_TICK = { fill: '#475569', fontSize: 11 } as const;
const AXIS_TICK_SM = { fill: '#475569', fontSize: 12 } as const;
const GRID_STROKE = '#e2e8f0';

/** id câu có thể đã chứa sẵn chữ "Câu" (vd. "Câu 27") — tránh hiển thị "Câu Câu 27". */
const questionLabel = (id: string | number): string => {
  const s = String(id).trim();
  return /^c[âa]u\b/i.test(s) ? s.replace(/^c[âa]u\s*/i, 'Câu ') : `Câu ${s}`;
};

const BUCKET_COLORS = ['#f43f5e', '#fb7185', '#f59e0b', '#38bdf8', '#34d399'];
const BIN_COUNT = 10;
const TOTAL_BIN_COUNT = 12;

type SectionKey = 'questions' | 'scores' | 'ranking' | 'trends' | 'all';

export function ClassAnalytics({ students, questions, metric, onMetricChange }: Props) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>(metric || 'irt');
  const [activeSection, setActiveSection] = useState<SectionKey>('questions');
  const [histView, setHistView] = useState<'total' | 'subjects'>('total');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  /** Mã đề để xem thứ tự câu theo đề thí sinh thực làm; `null` = theo đề gốc. */
  const [examCodeFilter, setExamCodeFilter] = useState<string | null>(null);
  /** Bảng 120 câu rất dài — mặc định mở, nhưng cho phép thu gọn để trang nhẹ hơn. */
  const [showQuestionTable, setShowQuestionTable] = useState(true);

  useEffect(() => {
    if (metric) setActiveMetric(metric);
  }, [metric]);

  const handleMetricToggle = (newMetric: MetricKey) => {
    setActiveMetric(newMetric);
    if (onMetricChange) onMetricChange(newMetric);
  };

  const latest = useMemo(() => latestAttempts(students), [students]);
  const maxTotalVal = totalMax(activeMetric);
  const maxSubjectVal = subjectMax(activeMetric);

  // Stats mô tả học thuật
  const stats = useMemo(() => {
    const tv = describe(sortedScores(latest, activeMetric, 'tv'));
    const ta = describe(sortedScores(latest, activeMetric, 'ta'));
    const toan = describe(sortedScores(latest, activeMetric, 'toan'));
    const tdkh = describe(sortedScores(latest, activeMetric, 'tdkh'));
    const totals = describe(sortedTotalScores(latest, activeMetric));
    return { tv, ta, toan, tdkh, totals };
  }, [latest, activeMetric]);

  // Top KPI tổng hợp
  const kpis = useMemo(() => {
    const rawTotals = latest.map(s => totalScore(s, activeMetric));
    const pass50 = rawTotals.filter(v => v >= maxTotalVal * 0.5).length;
    const good65 = rawTotals.filter(v => v >= maxTotalVal * 0.65).length;
    return {
      totalStudents: latest.length,
      avgTotal: stats.totals.avg,
      medTotal: stats.totals.med,
      maxTotal: stats.totals.max,
      minTotal: stats.totals.min,
      pass50Rate: latest.length ? (pass50 / latest.length) * 100 : 0,
      pass50Count: pass50,
      good65Rate: latest.length ? (good65 / latest.length) * 100 : 0,
      good65Count: good65,
    };
  }, [latest, stats, maxTotalVal, activeMetric]);

  // Histogram tổng bài
  const totalHistogramData = useMemo(() => {
    const binSize = maxTotalVal / TOTAL_BIN_COUNT;
    const bins = Array.from({ length: TOTAL_BIN_COUNT }, (_, i) => ({
      label: `${Math.round(i * binSize)}–${Math.round((i + 1) * binSize)}`,
      'Số thí sinh': 0,
    }));
    for (const s of latest) {
      const v = totalScore(s, activeMetric);
      const idx = Math.min(TOTAL_BIN_COUNT - 1, Math.max(0, Math.floor(v / binSize)));
      bins[idx]['Số thí sinh'] += 1;
    }
    return bins;
  }, [latest, activeMetric, maxTotalVal]);

  // Histogram 4 môn
  const subjectHistogramData = useMemo(() => {
    const binSize = maxSubjectVal / BIN_COUNT;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
      label: `${+(i * binSize).toFixed(0)}–${+((i + 1) * binSize).toFixed(0)}`,
      'Tiếng Việt': 0,
      'Tiếng Anh': 0,
      'Toán': 0,
      'Tư Duy Khoa Học': 0,
    }));

    for (const s of latest) {
      ALL_SUBJECTS.forEach(subj => {
        const v = subjectScore(s, activeMetric, subj);
        if (v === null) return;
        const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(v / binSize)));
        const labelKey = SUBJECT_LABEL[subj] as 'Tiếng Việt' | 'Tiếng Anh' | 'Toán' | 'Tư Duy Khoa Học';
        bins[idx][labelKey] += 1;
      });
    }
    return bins;
  }, [latest, activeMetric, maxSubjectVal]);

  // Donut chart xếp loại năng lực
  const bandData = useMemo(() => {
    const counts = abilityBands(activeMetric).map(b => ({ name: b.label, short: b.short, value: 0, color: b.color }));
    for (const s of latest) {
      const score = totalScore(s, activeMetric);
      const idx = bandOf(score, activeMetric);
      if (idx >= 0 && idx < counts.length) {
        counts[idx].value += 1;
      }
    }
    return counts;
  }, [latest, activeMetric]);

  // Radar chart cân bằng 4 môn — dựa trên TRUNG VỊ (không bị lệch bởi outlier/bài bỏ trống)
  const radarData = useMemo(() => {
    return ALL_SUBJECTS.map(subj => {
      const med = stats[subj].med;
      return {
        subject: SUBJECT_LABEL[subj],
        'Trung Vị': med,
        'Tỷ Lệ Đạt': +(stats[subj].n ? (med / maxSubjectVal) * 100 : 0).toFixed(1),
        max: maxSubjectVal,
      };
    });
  }, [stats, maxSubjectVal]);

  const thresholdData = useMemo(() => thresholdRows(latest, activeMetric), [latest, activeMetric]);

  // Ranking data
  const ranking = useMemo(() => rankList(latest, activeMetric), [latest, activeMetric]);
  const rankedList = useMemo(() => {
    let currentRank = 1;
    return ranking.map((item, idx) => {
      if (idx > 0 && item.score < ranking[idx - 1].score) {
        currentRank = idx + 1;
      }
      return { ...item, rank: currentRank };
    });
  }, [ranking]);

  const topTen = useMemo(() => rankedList.slice(0, 10), [rankedList]);

  // Questions stats
  const subjectOptions = useMemo(() => {
    const seen: string[] = [];
    for (const q of questions) {
      if (q.subject && !seen.includes(q.subject)) seen.push(q.subject);
    }
    return seen;
  }, [questions]);

  const questionStats = useMemo(() => {
    return questions
      .filter(q => !q.isError && q.totalAttempts && q.totalAttempts > 0 && typeof q.correct === 'number')
      .map(q => ({
        id: q.id,
        subject: q.subject,
        attempts: q.totalAttempts as number,
        correct: q.correct as number,
        incorrect: q.incorrect ?? 0,
        ratio: (q.correct as number) / (q.totalAttempts as number),
      }));
  }, [questions]);

  const difficultyBuckets = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}–${i * 10 + 10}%`,
      value: 0,
      fill: BUCKET_COLORS[Math.min(4, Math.floor(i / 2))],
    }));
    questionStats.forEach(q => {
      const idx = Math.min(9, Math.max(0, Math.floor(q.ratio * 10)));
      buckets[idx].value += 1;
    });
    return buckets;
  }, [questionStats]);

  const hardest = useMemo(
    () => [...questionStats].sort((a, b) => a.ratio - b.ratio).slice(0, 5),
    [questionStats]
  );
  const easiest = useMemo(
    () => [...questionStats].sort((a, b) => b.ratio - a.ratio).slice(0, 5),
    [questionStats]
  );

  // Attempts trends
  const trendData = useMemo(() => attemptAverages(students, activeMetric), [students, activeMetric]);
  const attemptData = useMemo(() => attemptDistribution(students), [students]);

  if (students.length === 0) return null;

  const renderRankTable = (rows: { student: StudentData; score: number; rank: number }[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              <th className="w-16 px-4 py-3 text-center">Hạng</th>
              <th className="px-4 py-3">Thí sinh</th>
              <th className="w-20 px-3 py-3 text-center" style={{ color: SUBJECT_COLOR.tv }}>TV</th>
              <th className="w-20 px-3 py-3 text-center" style={{ color: SUBJECT_COLOR.ta }}>TA</th>
              <th className="w-20 px-3 py-3 text-center" style={{ color: SUBJECT_COLOR.toan }}>Toán</th>
              <th className="w-20 px-3 py-3 text-center" style={{ color: SUBJECT_COLOR.tdkh }}>TDKH</th>
              <th className="w-40 px-4 py-3 text-right">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[13px]">
            {rows.map((r, index) => {
              const tv = subjectScore(r.student, activeMetric, 'tv') ?? 0;
              const ta = subjectScore(r.student, activeMetric, 'ta') ?? 0;
              const toan = subjectScore(r.student, activeMetric, 'toan') ?? 0;
              const tdkh = subjectScore(r.student, activeMetric, 'tdkh') ?? 0;
              const pct = Math.min(100, Math.round((r.score / maxTotalVal) * 100));
              const rankClass =
                r.rank === 1
                  ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                  : r.rank === 2
                  ? 'bg-slate-200 text-slate-700 ring-2 ring-slate-300'
                  : r.rank === 3
                  ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-300'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-xs';

              return (
                <tr
                  key={`${r.rank}-${r.student.email || r.student.name}-${index}`}
                  className="group transition-colors hover:bg-indigo-50/40"
                >
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-colors ${rankClass}`}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold leading-tight text-slate-800">{r.student.name}</div>
                  </td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums" style={{ color: SUBJECT_COLOR.tv }}>{tv}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums" style={{ color: SUBJECT_COLOR.ta }}>{ta}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums" style={{ color: SUBJECT_COLOR.toan }}>{toan}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums" style={{ color: SUBJECT_COLOR.tdkh }}>{tdkh}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-baseline justify-end gap-2">
                      <span className="text-sm font-black tabular-nums text-emerald-600">{r.score.toFixed(0)}</span>
                      <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-slate-400">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render Difficulty Card (Two-line layout per item - NEVER overlaps or collides)
  const renderDifficultyCard = (
    title: string,
    subtitle: string,
    rows: typeof hardest,
    isHard: boolean,
    iconNode: React.ReactNode
  ) => (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`icon-box ${isHard ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {iconNode}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {title}
            </h4>
            <p className="text-[11px] text-slate-500 font-normal truncate">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-semibold shrink-0">
          Tỷ lệ đúng
        </span>
      </div>

      <div className="flex flex-col gap-2 p-3 sm:p-4">
        {rows.map(q => {
          const pct = Math.round(q.ratio * 100);
          return (
            <div
              key={q.id}
              className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors flex flex-col gap-2"
            >
              {/* Row 1: Badges & Numbers with ample breathing room */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-white text-slate-900 border border-slate-200 shrink-0 whitespace-nowrap">
                    {questionLabel(q.id)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-700 truncate max-w-[140px]">
                    {q.subject}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs text-slate-500 tabular-nums font-medium">
                    {q.correct}/{q.attempts} đúng
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums min-w-[40px] text-right ${
                      isHard ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Row 2: Full-width Progress Bar */}
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHard
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 fade-in">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HEADER CARD: TỔNG HỢP TOÀN KHÓA & BỘ CHỌN THANG ĐIỂM          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {latest.length} thí sinh · {questions.length} câu hỏi
            </p>
            <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">
              Báo Cáo Phân Tích Toàn Khóa
            </h2>
          </div>

          {/* Metric Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit shrink-0 self-start sm:self-auto flex-wrap">
            {([
              ['irt', 'Chuẩn hoá IRT MIT (1200đ)'],
              ['tho', 'Điểm Thô (120 câu)'],
              ['vnno1', 'Quy đổi VNNo1 (1200đ)'],
            ] as [MetricKey, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMetricToggle(key)}
                className={`px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeMetric === key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Section Navigation Tabs (Gọn gàng & Chia đúng phần) */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveSection('questions')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === 'questions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Phân Tích Câu Hỏi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('scores')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === 'scores'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Phổ Điểm &amp; Năng Lực</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ranking')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === 'ranking'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Bảng Xếp Hạng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('trends')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === 'trends'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Tiến Trình &amp; Xu Hướng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ml-auto ${
              activeSection === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Xem Tất Cả</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 1: PHÂN TÍCH CÂU HỎI (ITEM ANALYSIS) - ƯU TIÊN HÀNG ĐẦU    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'questions' || activeSection === 'all') && (
        <section id="cau-hoi" className="flex flex-col gap-5">
          <div className="pt-1">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-slate-500" />
                Phân Tích Câu Hỏi &amp; Độ Phân Hóa Đề Thi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {questionStats.length} câu hỏi hợp lệ · Đánh giá độ khó, độ phân biệt và câu hỏi tiêu biểu
              </p>
            </div>
          </div>

          {/* Biểu đồ Phân Bố Độ Khó Đề Thi */}
          <div className="card p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="icon-box bg-slate-100 text-slate-600">
                    <Activity className="w-4 h-4" />
                  </span>
                  Phân Bố Độ Khó Đề Thi (Item Difficulty Distribution)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Số lượng câu hỏi theo từng khoảng tỷ lệ làm đúng (%)
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 w-fit">
                10 khoảng tỷ lệ (0% - 100%)
              </span>
            </div>

            <div className="h-[240px] sm:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyBuckets} margin={{ top: 15, right: 15, left: -18, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={AXIS_TICK}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_SM} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipBox} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" name="Số câu" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    <LabelList dataKey="value" position="top" style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} />
                    {difficultyBuckets.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Câu Hỏi Khó Nhất & Dễ Nhất: 2 Cột Riêng Biệt, Rộng Rãi, KHÔNG CHỒNG CHÉO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderDifficultyCard(
              'Top 5 Câu Hỏi Khó Nhất',
              'Tỷ lệ làm đúng thấp nhất · Nhóm câu phân hóa thí sinh giỏi',
              hardest,
              true,
              <Flame className="w-4 h-4 text-rose-500" />
            )}
            {renderDifficultyCard(
              'Top 5 Câu Hỏi Dễ Nhất',
              'Tỷ lệ làm đúng cao nhất · Nhóm câu nền tảng cơ bản',
              easiest,
              false,
              <CheckSquare className="w-4 h-4 text-emerald-500" />
            )}
          </div>

          {/* Bảng Thống Kê Toàn Bộ 120 Câu Hỏi */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span className="icon-box bg-slate-100 text-slate-600">
                    <ListFilter className="w-4 h-4" />
                  </span>
                  Chi Tiết 120 Câu Hỏi
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tỷ lệ đúng · đúng/sai · độ khó (b) · độ phân biệt (a) · D · Infit/Outfit
                  {examCodeFilter ? ` · theo mã đề ${examCodeFilter}` : ''}
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg w-fit flex-wrap gap-0.5">
                {(['all', ...subjectOptions] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjectFilter(s)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      subjectFilter === s
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s === 'all' ? 'Tất cả' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn mã đề: xem thông số theo thứ tự câu thí sinh đã làm. */}
            <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5" />
                Thứ tự câu theo
              </span>
              <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg w-fit flex-wrap gap-0.5">
                {([null, ...AVAILABLE_EXAM_CODES] as (string | null)[]).map(code => (
                  <button
                    key={code ?? 'original'}
                    type="button"
                    onClick={() => setExamCodeFilter(code)}
                    title={code ? `Thứ tự câu trên mã đề ${code}` : 'Thứ tự câu theo đề gốc'}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      examCodeFilter === code
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {code ?? 'Đề gốc'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500">
                {examCodeFilter ? `Theo thứ tự câu trên mã đề ${examCodeFilter}` : 'Theo thứ tự đề gốc'}
              </span>
              <button
                type="button"
                onClick={() => setShowQuestionTable(v => !v)}
                aria-expanded={showQuestionTable}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {showQuestionTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showQuestionTable ? 'Thu gọn bảng' : `Mở bảng (${questions.length} câu)`}
              </button>
            </div>

            {showQuestionTable && (
              <div className="max-h-[560px] overflow-y-auto">
                <QuestionTable
                  data={questions}
                  selectedSubject={subjectFilter}
                  examCode={examCodeFilter}
                />
              </div>
            )}
          </div>

          {/* ICC / IIF tương tác cho từng câu hỏi */}
          <ItemCurveSection questions={questions} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 2: PHỔ ĐIỂM & ĐÁNH GIÁ NĂNG LỰC TOÀN KHÓA                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'scores' || activeSection === 'all') && (
        <section id="pho-diem" className="flex flex-col gap-5">
          <div className="pt-1">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                Phổ Điểm &amp; Phân Bổ Năng Lực Toàn Bộ Thí Sinh
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ số KPI, phổ điểm 4 môn thi, xếp loại và độ cân bằng năng lực
              </p>
            </div>
          </div>

          {/* 5 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Users className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Tổng Thí Sinh
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 tabular-nums">
                  {kpis.totalStudents}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Lần thi mới nhất</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <BarChart3 className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Điểm Trung Bình
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {kpis.avgTotal.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Trung vị: {kpis.medTotal.toFixed(1)}</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Award className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Điểm Cao Nhất
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {kpis.maxTotal.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Thấp nhất: {kpis.minTotal.toFixed(1)}</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                  <Target className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Đạt ≥ 50% Điểm
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {kpis.pass50Rate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {kpis.pass50Count}/{kpis.totalStudents} thí sinh
                </p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Giỏi &amp; Xuất Sắc
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {kpis.good65Rate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {kpis.good65Count}/{kpis.totalStudents} thí sinh (≥ 65%)
                </p>
              </div>
            </div>
          </div>

          {/* 4 Môn Quick Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ALL_SUBJECTS.map(subj => {
              const s = stats[subj];
              const color = SUBJECT_COLOR[subj];
              return (
                <div
                  key={subj}
                  className="card p-3.5 flex flex-col justify-between border-t-2"
                  style={{ borderTopColor: color }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ backgroundColor: color }} />
                      {SUBJECT_LABEL[subj]}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">Max {maxSubjectVal}</span>
                  </div>
                  <div className="my-1.5 flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-slate-900">
                      {s.avg.toFixed(1)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      TB ({((s.avg / maxSubjectVal) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
                    <span>Trung vị: <span className="font-semibold text-slate-700">{s.med.toFixed(1)}</span></span>
                    <span>Max: {s.max.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Biểu đồ Phân Bố Tần Suất Điểm Số (Histogram) */}
          <div className="card p-5 sm:p-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="icon-box bg-slate-100 text-slate-600">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  Phân Bố Tần Suất Điểm Số
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {histView === 'total'
                    ? `Phổ điểm tổng toàn bài thi (thang 0–${maxTotalVal})`
                    : `Phổ điểm chi tiết của từng môn (thang 0–${maxSubjectVal}/môn)`}
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setHistView('total')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    histView === 'total'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tổng Toàn Bài Thi
                </button>
                <button
                  type="button"
                  onClick={() => setHistView('subjects')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    histView === 'subjects'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Từng Môn (4 Môn)
                </button>
              </div>
            </div>

            <div className="h-[260px] sm:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {histView === 'total' ? (
                  <BarChart data={totalHistogramData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_SM} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipBox} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="Số thí sinh" name="Số thí sinh" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      <LabelList dataKey="Số thí sinh" position="top" style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={subjectHistogramData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_SM} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipBox} cursor={{ fill: '#f1f5f9' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                    <Bar dataKey="Tiếng Việt" name="Tiếng Việt" fill={SUBJECT_COLOR.tv} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="Tiếng Anh" name="Tiếng Anh" fill={SUBJECT_COLOR.ta} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="Toán" name="Toán" fill={SUBJECT_COLOR.toan} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="Tư Duy Khoa Học" name="TDKH" fill={SUBJECT_COLOR.tdkh} radius={[4, 4, 0, 0]} maxBarSize={16} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2 Cột: Donut Xếp Loại & Radar Cân Bằng */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut Chart: Xếp loại năng lực */}
            <div className="card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <span className="icon-box bg-emerald-50 text-emerald-600">
                    <Award className="w-4 h-4" />
                  </span>
                  Xếp Loại Năng Lực Toàn Khóa
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Cơ cấu 5 mức xếp loại tính trên tổng điểm 4 môn (0–{maxTotalVal})
                </p>
              </div>

              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bandData}
                      dataKey="value"
                      nameKey="short"
                      innerRadius="50%"
                      outerRadius="80%"
                      paddingAngle={3}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {bandData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipBox}
                      formatter={(val: any, _name: any, p: any) => [
                        `${val} thí sinh (${((+val / latest.length) * 100).toFixed(1)}%)`,
                        p.payload.name,
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(val: any, entry: any) => {
                        const count = entry?.payload?.value;
                        const pct = count ? ((count / latest.length) * 100).toFixed(0) : 0;
                        return `${val}: ${count} TS (${pct}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar Chart: Đánh giá cân bằng 4 môn */}
            <div className="card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <span className="icon-box bg-sky-50 text-sky-600">
                    <Compass className="w-4 h-4" />
                  </span>
                  Đánh Giá Cân Bằng Năng Lực 4 Môn (Trung Vị)
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Trung vị điểm từng phân môn của toàn khóa, quy về % thang điểm môn ({maxSubjectVal}đ)
                </p>
              </div>

              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#cbd5e1" strokeOpacity={0.7} strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} unit="%" />
                    <Radar
                      name="Trung vị (%)"
                      dataKey="Tỷ Lệ Đạt"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      fill="#38bdf8"
                      fillOpacity={0.28}
                      dot={{ r: 4, fill: '#0284c7', strokeWidth: 0 }}
                    />
                    <Tooltip
                      contentStyle={tooltipBox}
                      formatter={(val: any, _name: any, p: any) => [
                        `${val}% (Trung vị: ${p.payload['Trung Vị'].toFixed(1)}/${p.payload.max})`,
                        p.payload.subject,
                      ]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tỷ Lệ Đạt Các Ngưỡng Điểm */}
          <div className="card p-5 sm:p-6">
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <span className="icon-box bg-slate-100 text-slate-600">
                <Target className="w-4 h-4" />
              </span>
              Tỷ Lệ Đạt Các Ngưỡng Chuẩn Toàn Khóa (Theo Trung Vị)
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Tỷ lệ thí sinh có trung vị 4 môn (quy về thang {maxTotalVal}) đạt từng mốc — đếm theo trung vị để không bị kéo lệch bởi bài bỏ trống
            </p>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thresholdData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
                  <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={tooltipBox}
                    formatter={(v: any, _n: any, p: any) => [`${(+v).toFixed(1)}% (${p.payload.count} thí sinh)`, 'Tỷ lệ']}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="percent" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20}>
                    <LabelList
                      dataKey="percent"
                      position="right"
                      formatter={(v: any) => `${(+v).toFixed(1)}%`}
                      style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bảng Thống Kê Phân Tán Chi Tiết */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 text-indigo-600">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  Bảng Thống Kê Phân Tán Chi Tiết
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toàn bộ các chỉ số thống kê mô tả học thuật: Min, Q1, Trung vị, Q3, P90, Max, Trung bình, STĐ
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white">
              <table className="w-full text-sm text-left border-collapse border border-slate-200 min-w-[860px]">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="border border-slate-200 px-3.5 py-3">Phần Thi / Tổng</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Số TS</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Thấp nhất</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Q1 (25%)</th>
                    <th className="border border-slate-200 px-3 py-3 text-center font-bold">Trung vị</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Q3 (75%)</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">P90</th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Cao nhất</th>
                    <th className="border border-slate-200 px-3.5 py-3 text-center bg-indigo-50/70 font-bold text-indigo-600">
                      Trung bình
                    </th>
                    <th className="border border-slate-200 px-3 py-3 text-center">Độ lệch chuẩn (STĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {ALL_SUBJECTS.map(subj => {
                    const d = stats[subj];
                    return (
                      <tr key={subj} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-200 px-3.5 py-2.5 font-semibold text-slate-700 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLOR[subj] }} />
                          <span>{SUBJECT_LABEL[subj]}</span>
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-500">
                          {d.n}
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.min.toFixed(1)}</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.q1.toFixed(1)}</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums font-bold text-slate-800">
                          {d.med.toFixed(1)}
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.q3.toFixed(1)}</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.p90.toFixed(1)}</td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums font-bold text-emerald-600">
                          {d.max.toFixed(1)}
                        </td>
                        <td className="border border-slate-200 px-3.5 py-2.5 text-center tabular-nums font-bold text-indigo-600 bg-indigo-50/40">
                          {d.avg.toFixed(2)}
                        </td>
                        <td className="border border-slate-200 px-3 py-2.5 text-center tabular-nums text-slate-500">
                          {d.std.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-indigo-50/50 font-semibold text-slate-800 border-t-2 border-indigo-200">
                    <td className="border border-slate-200 px-3.5 py-3 text-indigo-700 flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <span>TỔNG TOÀN BÀI THI (4 MÔN)</span>
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.n}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.min.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.q1.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-indigo-600 text-sm font-bold">
                      {stats.totals.med.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.q3.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.p90.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-emerald-600 text-sm font-bold">
                      {stats.totals.max.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 px-3.5 py-3 text-center tabular-nums text-indigo-700 text-sm font-bold bg-indigo-100/60">
                      {stats.totals.avg.toFixed(2)}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-center tabular-nums text-slate-500">
                      {stats.totals.std.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <DeepAnalysis students={latest} questions={questions} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 3: BẢNG XẾP HẠNG TOÀN KHÓA                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'ranking' || activeSection === 'all') && (
        <section id="xep-hang" className="flex flex-col gap-4">
          {activeSection === 'all' && (
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
              <Trophy className="w-5 h-5 text-slate-500" />
              Bảng Xếp Hạng Toàn Khóa
            </h3>
          )}
          {renderRankTable(topTen)}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 5: TIẾN TRÌNH & XU HƯỚNG QUA TỪNG LẦN THI                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'trends' || activeSection === 'all') && (
        <section id="xu-huong" className="flex flex-col gap-5">
          <div className="pt-1">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                Xu Hướng &amp; Tiến Trình Qua Từng Lần Thi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Điểm trung bình 4 môn thi qua từng đợt và cơ cấu số lần tham gia
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Trend Area Chart (4 Môn) */}
            <div className="card p-5 lg:col-span-2 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 text-indigo-600">
                    <Activity className="w-4 h-4" />
                  </span>
                  Điểm Trung Bình 4 Môn Qua Từng Lần Thi
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Điểm trung bình theo {METRIC_LABEL[activeMetric]} của tất cả thí sinh ở lần thi thứ n
                </p>
              </div>

              <div className="h-[260px] sm:h-[300px] w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradTv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUBJECT_COLOR.tv} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={SUBJECT_COLOR.tv} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradTa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUBJECT_COLOR.ta} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={SUBJECT_COLOR.ta} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradToan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUBJECT_COLOR.toan} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={SUBJECT_COLOR.toan} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradTdkh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SUBJECT_COLOR.tdkh} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={SUBJECT_COLOR.tdkh} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK_SM} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_SM} />
                    <Tooltip contentStyle={tooltipBox} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                    <Area
                      type="monotone"
                      dataKey="Tiếng Việt"
                      stroke={SUBJECT_COLOR.tv}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradTv)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Tiếng Anh"
                      stroke={SUBJECT_COLOR.ta}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradTa)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Toán"
                      stroke={SUBJECT_COLOR.toan}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradToan)"
                    />
                    <Area
                      type="monotone"
                      dataKey="TDKH"
                      stroke={SUBJECT_COLOR.tdkh}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradTdkh)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cơ cấu số lần thi */}
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <span className="icon-box bg-violet-50 text-violet-600">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  Cơ Cấu Số Lần Thi
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Số thí sinh tham gia 1, 2, 3… lần thi
                </p>
              </div>

              <div className="h-[260px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attemptData} margin={{ top: 15, right: 15, left: -16, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK_SM} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipBox} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" name="Số thí sinh" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
