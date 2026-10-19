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
} from 'lucide-react';

interface Props {
  students: StudentData[];
  questions: QuestionData[];
  metric: MetricKey;
  onMetricChange?: (m: MetricKey) => void;
}

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  fontSize: '13px',
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(8px)',
  color: '#1e293b',
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

  // Radar chart cân bằng 4 môn
  const radarData = useMemo(() => {
    return [
      {
        subject: 'Tiếng Việt',
        'Điểm Trung Bình': stats.tv.avg,
        'Tỷ Lệ Đạt': +((stats.tv.avg / maxSubjectVal) * 100).toFixed(1),
        max: maxSubjectVal,
      },
      {
        subject: 'Tiếng Anh',
        'Điểm Trung Bình': stats.ta.avg,
        'Tỷ Lệ Đạt': +((stats.ta.avg / maxSubjectVal) * 100).toFixed(1),
        max: maxSubjectVal,
      },
      {
        subject: 'Toán',
        'Điểm Trung Bình': stats.toan.avg,
        'Tỷ Lệ Đạt': +((stats.toan.avg / maxSubjectVal) * 100).toFixed(1),
        max: maxSubjectVal,
      },
      {
        subject: 'Tư Duy Khoa Học',
        'Điểm Trung Bình': stats.tdkh.avg,
        'Tỷ Lệ Đạt': +((stats.tdkh.avg / maxSubjectVal) * 100).toFixed(1),
        max: maxSubjectVal,
      },
    ];
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
  const bottomTen = useMemo(() => rankedList.slice(-10), [rankedList]);

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

  // Render Table Ranking
  const renderRankTable = (
    title: string,
    rows: { student: StudentData; score: number; rank: number }[],
    isTop: boolean,
    icon: React.ReactNode,
    iconBox: string,
    scoreColor: string
  ) => (
    <div className="card overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(60,80,160,0.08)] rounded-2xl flex flex-col justify-between">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
          <span className={`icon-box ${iconBox}`}>{icon}</span>
          <span>{title}</span>
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Thang {maxTotalVal} {activeMetric === 'tho' ? 'câu' : 'điểm'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse min-w-[540px]">
          <thead className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 uppercase font-semibold">
            <tr>
              <th className="px-3 py-2.5 w-14 text-center">Hạng</th>
              <th className="px-3 py-2.5">Thí sinh</th>
              <th className="px-2 py-2.5 text-center text-rose-500 w-14">TV</th>
              <th className="px-2 py-2.5 text-center text-purple-500 w-14">TA</th>
              <th className="px-2 py-2.5 text-center text-indigo-500 w-14">Toán</th>
              <th className="px-2 py-2.5 text-center text-sky-500 w-14">TDKH</th>
              <th className="px-3 py-2.5 text-right w-24">Tổng</th>
              <th className="px-3 py-2.5 text-right w-20">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {rows.map(r => {
              const tv = subjectScore(r.student, activeMetric, 'tv') ?? 0;
              const ta = subjectScore(r.student, activeMetric, 'ta') ?? 0;
              const toan = subjectScore(r.student, activeMetric, 'toan') ?? 0;
              const tdkh = subjectScore(r.student, activeMetric, 'tdkh') ?? 0;
              const pct = Math.min(100, Math.round((r.score / maxTotalVal) * 100));

              return (
                <tr
                  key={r.student.sbd || r.student.email || r.student.name}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold ${
                        isTop && r.rank === 1
                          ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400 shadow-xs'
                          : isTop && r.rank === 2
                          ? 'bg-slate-200 text-slate-800 ring-2 ring-slate-300 shadow-xs'
                          : isTop && r.rank === 3
                          ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-xs'
                          : isTop
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isTop && r.rank === 1 ? '🥇 1' : isTop && r.rank === 2 ? '🥈 2' : isTop && r.rank === 3 ? '🥉 3' : `#${r.rank}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                    <div>{r.student.name}</div>
                    {r.student.sbd && (
                      <div className="text-[10px] text-slate-400 font-normal">SBD: {r.student.sbd}</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{tv}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{ta}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{toan}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{tdkh}</td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums text-sm ${scoreColor}`}>
                    {r.score.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 font-medium">
                    {pct}%
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
    <div className="card p-5 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95 border border-white/90 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(60,80,160,0.08)] rounded-2xl">
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className={`icon-box ${isHard ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60'}`}>
            {iconNode}
          </span>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
              {title}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">
          Tỷ lệ đúng
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map(q => {
          const pct = Math.round(q.ratio * 100);
          return (
            <div
              key={q.id}
              className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex flex-col gap-2"
            >
              {/* Row 1: Badges & Numbers with ample breathing room */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-600 shrink-0 shadow-2xs">
                    Câu {q.id}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 truncate">
                    {q.subject}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums font-normal">
                    {q.correct}/{q.attempts} đúng
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums min-w-[40px] text-right ${
                      isHard ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Row 2: Full-width Progress Bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
      <div className="card p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(60,80,160,0.08)] rounded-3xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                Thống Kê Toàn Khóa
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {latest.length} thí sinh · {questions.length} câu hỏi
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              Báo Cáo Phân Tích &amp; Thống Kê Toàn Khóa
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Tổng hợp dữ liệu lần thi mới nhất · Thang {activeMetric === 'tho' ? '120 câu đúng' : 'chuẩn hóa 1200 điểm'}
            </p>
          </div>

          {/* Metric Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit shadow-inner border border-slate-200/60 dark:border-slate-700 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleMetricToggle('irt')}
              className={`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeMetric === 'irt'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Chuẩn hoá IRT (1200đ)
            </button>
            <button
              type="button"
              onClick={() => handleMetricToggle('tho')}
              className={`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeMetric === 'tho'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Điểm Thô (120 câu)
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs (Gọn gàng & Chia đúng phần) */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto hide-scrollbar pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('questions')}
            className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === 'questions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
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
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
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
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
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
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-rose-500 bg-white/95 dark:bg-slate-900/95">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-rose-500" />
                Phân Tích Câu Hỏi &amp; Độ Phân Hóa Đề Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {questionStats.length} câu hỏi hợp lệ · Đánh giá độ khó, độ phân biệt và câu hỏi tiêu biểu
              </p>
            </div>
          </div>

          {/* Biểu đồ Phân Bố Độ Khó Đề Thi */}
          <div className="card p-5 sm:p-6 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="icon-box bg-sky-50 dark:bg-sky-950/60 text-sky-600">
                    <Activity className="w-4 h-4" />
                  </span>
                  Phân Bố Độ Khó Đề Thi (Item Difficulty Distribution)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Số lượng câu hỏi theo từng khoảng tỷ lệ làm đúng (%)
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-fit">
                10 khoảng tỷ lệ (0% - 100%)
              </span>
            </div>

            <div className="h-[240px] sm:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyBuckets} margin={{ top: 15, right: 15, left: -18, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="Số câu" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    <LabelList dataKey="value" position="top" style={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
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
          <div className="card overflow-hidden bg-white/95 dark:bg-slate-900/95">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                    <ListFilter className="w-4 h-4" />
                  </span>
                  Bảng Thống Kê Chi Tiết Toàn Bộ 120 Câu Hỏi
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Xem thông số IRT: độ khó (b), độ phân biệt (a), số thí sinh làm đúng/sai
                </p>
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
                {(['all', ...subjectOptions] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjectFilter(s)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      subjectFilter === s
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {s === 'all' ? 'Tất cả 120 câu' : s}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[520px] overflow-y-auto bg-white dark:bg-slate-800">
              <QuestionTable data={questions} selectedSubject={subjectFilter} />
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 2: PHỔ ĐIỂM & ĐÁNH GIÁ NĂNG LỰC TOÀN KHÓA                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'scores' || activeSection === 'all') && (
        <section id="pho-diem" className="flex flex-col gap-5">
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-indigo-600 bg-white/95 dark:bg-slate-900/95">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Phổ Điểm &amp; Phân Bổ Năng Lực Toàn Bộ Thí Sinh
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chỉ số KPI, phổ điểm 4 môn thi, xếp loại và độ cân bằng năng lực
              </p>
            </div>
          </div>

          {/* 5 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Tổng Thí Sinh
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                  {kpis.totalStudents}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Lần thi mới nhất</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Điểm Trung Bình
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {kpis.avgTotal.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Trung vị: {kpis.medTotal.toFixed(1)}</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Award className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Điểm Cao Nhất
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {kpis.maxTotal.toFixed(1)}{' '}
                  <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Thấp nhất: {kpis.minTotal.toFixed(1)}</p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Target className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Đạt ≥ 50% Điểm
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {kpis.pass50Rate.toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {kpis.pass50Count}/{kpis.totalStudents} thí sinh
                </p>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform col-span-2 lg:col-span-1 bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  Giỏi &amp; Xuất Sắc
                </span>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">
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
                  className="card p-3.5 flex flex-col justify-between border-t-2 bg-white/95 dark:bg-slate-900/95"
                  style={{ borderTopColor: color }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color }}>
                      {SUBJECT_LABEL[subj]}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">Max {maxSubjectVal}</span>
                  </div>
                  <div className="my-1.5 flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {s.avg.toFixed(1)}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      TB ({((s.avg / maxSubjectVal) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1">
                    <span>Trung vị: {s.med.toFixed(1)}</span>
                    <span>Max: {s.max.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Biểu đồ Phân Bố Tần Suất Điểm Số (Histogram) */}
          <div className="card p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(60,80,160,0.08)] rounded-3xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  Phân Bố Tần Suất Điểm Số
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {histView === 'total'
                    ? `Phổ điểm tổng toàn bài thi (thang 0–${maxTotalVal})`
                    : `Phổ điểm chi tiết của từng môn (thang 0–${maxSubjectVal}/môn)`}
                </p>
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setHistView('total')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    histView === 'total'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tổng Toàn Bài Thi
                </button>
                <button
                  type="button"
                  onClick={() => setHistView('subjects')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    histView === 'subjects'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="Số thí sinh" name="Số thí sinh" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      <LabelList dataKey="Số thí sinh" position="top" style={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={subjectHistogramData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
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
            <div className="card p-5 sm:p-6 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                  <span className="icon-box bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                    <Award className="w-4 h-4" />
                  </span>
                  Xếp Loại Năng Lực Toàn Khóa
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
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
                      contentStyle={tooltipStyle}
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
            <div className="card p-5 sm:p-6 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                  <span className="icon-box bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                    <Compass className="w-4 h-4" />
                  </span>
                  Đánh Giá Cân Bằng Năng Lực 4 Môn
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Tỷ lệ hoàn thành trung bình của toàn khóa ở từng phân môn (%)
                </p>
              </div>

              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%" />
                    <Radar
                      name="Tỷ lệ đạt TB"
                      dataKey="Tỷ Lệ Đạt"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fill="#8b5cf6"
                      fillOpacity={0.4}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, _name: any, p: any) => [
                        `${val}% (TB: ${p.payload['Điểm Trung Bình'].toFixed(1)}/${p.payload.max})`,
                        p.payload.subject,
                      ]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tỷ Lệ Đạt Các Ngưỡng Điểm */}
          <div className="card p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95">
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
              <span className="icon-box bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                <Target className="w-4 h-4" />
              </span>
              Tỷ Lệ Đạt Các Ngưỡng Chuẩn Toàn Khóa
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Tỷ lệ thí sinh vượt qua các mốc điểm quan trọng trên thang tổng {maxTotalVal}
            </p>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thresholdData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, _n: any, p: any) => [`${(+v).toFixed(1)}% (${p.payload.count} thí sinh)`, 'Tỷ lệ']}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="percent" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20}>
                    <LabelList
                      dataKey="percent"
                      position="right"
                      formatter={(v: any) => `${(+v).toFixed(1)}%`}
                      style={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bảng Thống Kê Phân Tán Chi Tiết */}
          <div className="card overflow-hidden bg-white/95 dark:bg-slate-900/95">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  Bảng Thống Kê Phân Tán Chi Tiết
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toàn bộ các chỉ số thống kê mô tả học thuật: Min, Q1, Trung vị, Q3, P90, Max, Trung bình, STĐ
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-slate-800">
              <table className="w-full text-sm text-left border-collapse border border-slate-200 dark:border-slate-700 min-w-[860px]">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="border border-slate-200 dark:border-slate-700 px-3.5 py-3">Phần Thi / Tổng</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Số TS</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Thấp nhất</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Q1 (25%)</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center font-bold">Trung vị</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Q3 (75%)</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">P90</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Cao nhất</th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-center bg-indigo-50/70 dark:bg-indigo-950/40 font-bold text-indigo-600 dark:text-indigo-400">
                      Trung bình
                    </th>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Độ lệch chuẩn (STĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {ALL_SUBJECTS.map(subj => {
                    const d = stats[subj];
                    return (
                      <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLOR[subj] }} />
                          <span>{SUBJECT_LABEL[subj]}</span>
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-500">
                          {d.n}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.min.toFixed(1)}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.q1.toFixed(1)}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums font-bold text-slate-800 dark:text-slate-100">
                          {d.med.toFixed(1)}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.q3.toFixed(1)}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-600">{d.p90.toFixed(1)}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums font-bold text-emerald-600">
                          {d.max.toFixed(1)}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-center tabular-nums font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20">
                          {d.avg.toFixed(2)}
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-500">
                          {d.std.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-indigo-50/50 dark:bg-indigo-950/40 font-semibold text-slate-800 dark:text-slate-100 border-t-2 border-indigo-200 dark:border-indigo-800">
                    <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-indigo-700 dark:text-indigo-300 flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <span>TỔNG TOÀN BÀI THI (4 MÔN)</span>
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.n}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.min.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.q1.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                      {stats.totals.med.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.q3.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-600">
                      {stats.totals.p90.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-emerald-600 text-sm font-bold">
                      {stats.totals.max.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-center tabular-nums text-indigo-700 dark:text-indigo-300 text-sm font-bold bg-indigo-100/60 dark:bg-indigo-900/50">
                      {stats.totals.avg.toFixed(2)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-slate-500">
                      {stats.totals.std.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 3: BẢNG XẾP HẠNG TOÀN KHÓA                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'ranking' || activeSection === 'all') && (
        <section id="xep-hang" className="flex flex-col gap-5">
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-amber-500 bg-white/95 dark:bg-slate-900/95">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Bảng Xếp Hạng Toàn Khóa (Đủ 4 Môn Thi)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vinh danh Top 10 điểm cao nhất và thống kê nhóm cần nỗ lực thêm
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {renderRankTable(
              'Top 10 Thí Sinh Điểm Cao Nhất',
              topTen,
              true,
              <Trophy className="w-4 h-4 text-amber-500" />,
              'bg-amber-50 dark:bg-amber-950/60 text-amber-500',
              'text-emerald-600 dark:text-emerald-400'
            )}
            {renderRankTable(
              'Top 10 Thí Sinh Cần Nỗ Lực Thêm',
              bottomTen,
              false,
              <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
              'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400',
              'text-slate-700 dark:text-slate-200'
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PHẦN 4: TIẾN TRÌNH & XU HƯỚNG QUA TỪNG LẦN THI                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(activeSection === 'trends' || activeSection === 'all') && (
        <section id="xu-huong" className="flex flex-col gap-5">
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-emerald-600 bg-white/95 dark:bg-slate-900/95">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Xu Hướng &amp; Tiến Trình Qua Từng Lần Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Điểm trung bình 4 môn thi qua từng đợt và cơ cấu số lần tham gia
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Trend Area Chart (4 Môn) */}
            <div className="card p-5 lg:col-span-2 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                  <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                    <Activity className="w-4 h-4" />
                  </span>
                  Điểm Trung Bình 4 Môn Qua Từng Lần Thi
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
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
            <div className="card p-5 flex flex-col justify-between bg-white/95 dark:bg-slate-900/95">
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                  <span className="icon-box bg-violet-50 dark:bg-violet-950/60 text-violet-600">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  Cơ Cấu Số Lần Thi
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Số thí sinh tham gia 1, 2, 3… lần thi
                </p>
              </div>

              <div className="h-[260px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attemptData} margin={{ top: 15, right: 15, left: -16, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
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
