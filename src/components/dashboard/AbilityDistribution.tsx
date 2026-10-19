import React, { useMemo, useState } from 'react';
import { MetricKey, StudentData, SubjectKey } from '../../types';
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
} from '../../lib/analytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
  BarChart as BarChartIcon,
  Award,
  FileSpreadsheet,
  Users,
  Target,
  Compass,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  students: StudentData[];
  metric: MetricKey;
  onMetricChange: (m: MetricKey) => void;
}

const METRICS: { key: MetricKey; label: string; short: string }[] = [
  { key: 'irt', label: 'Điểm Chuẩn Hoá Neo Đề (IRT 0–1200)', short: 'Chuẩn hoá IRT (1200đ)' },
  { key: 'tho', label: 'Điểm Thô (Số câu đúng 0–120)', short: 'Điểm Thô (120 câu)' },
];

const BIN_COUNT = 10;
const TOTAL_BIN_COUNT = 12;

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  fontSize: '13px',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
};

export function AbilityDistribution({ students, metric, onMetricChange }: Props) {
  const [histView, setHistView] = useState<'subjects' | 'total'>('total');

  const latest = useMemo(() => latestAttempts(students), [students]);

  // Thống kê mô tả từng môn + tổng
  const stats = useMemo(() => {
    const tv = describe(sortedScores(latest, metric, 'tv'));
    const ta = describe(sortedScores(latest, metric, 'ta'));
    const toan = describe(sortedScores(latest, metric, 'toan'));
    const tdkh = describe(sortedScores(latest, metric, 'tdkh'));
    const totals = describe(sortedTotalScores(latest, metric));
    return { tv, ta, toan, tdkh, totals };
  }, [latest, metric]);

  const maxTotalVal = totalMax(metric);
  const maxSubjectVal = subjectMax(metric);

  // Chỉ số KPI nổi bật
  const kpis = useMemo(() => {
    const rawTotals = latest.map(s => totalScore(s, metric));
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
  }, [latest, stats, maxTotalVal, metric]);

  // Histogram 4 môn riêng biệt (10 khoảng điểm)
  const subjectHistogramData = useMemo(() => {
    const binSize = maxSubjectVal / BIN_COUNT;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => {
      const from = +(i * binSize).toFixed(0);
      const to = +((i + 1) * binSize).toFixed(0);
      return {
        label: `${from}–${to}`,
        'Tiếng Việt': 0,
        'Tiếng Anh': 0,
        'Toán': 0,
        'Tư Duy Khoa Học': 0,
      };
    });

    for (const s of latest) {
      ALL_SUBJECTS.forEach(subj => {
        const v = subjectScore(s, metric, subj);
        if (v === null) return;
        const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(v / binSize)));
        const labelKey = SUBJECT_LABEL[subj] as 'Tiếng Việt' | 'Tiếng Anh' | 'Toán' | 'Tư Duy Khoa Học';
        bins[idx][labelKey] += 1;
      });
    }
    return bins;
  }, [latest, metric, maxSubjectVal]);

  // Histogram Tổng Điểm (12 khoảng điểm)
  const totalHistogramData = useMemo(() => {
    const binSize = maxTotalVal / TOTAL_BIN_COUNT;
    const bins = Array.from({ length: TOTAL_BIN_COUNT }, (_, i) => {
      const from = Math.round(i * binSize);
      const to = Math.round((i + 1) * binSize);
      return {
        label: `${from}–${to}`,
        'Số thí sinh': 0,
      };
    });

    for (const s of latest) {
      const v = totalScore(s, metric);
      const idx = Math.min(TOTAL_BIN_COUNT - 1, Math.max(0, Math.floor(v / binSize)));
      bins[idx]['Số thí sinh'] += 1;
    }
    return bins;
  }, [latest, metric, maxTotalVal]);

  // Xếp loại năng lực (Donut chart 5 mức)
  const bandData = useMemo(() => {
    const counts = abilityBands(metric).map(b => ({ name: b.label, short: b.short, value: 0, color: b.color }));
    for (const s of latest) {
      const score = totalScore(s, metric);
      const idx = bandOf(score, metric);
      if (idx >= 0 && idx < counts.length) {
        counts[idx].value += 1;
      }
    }
    return counts;
  }, [latest, metric]);

  // Radar trung bình 4 môn
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

  const thresholdData = useMemo(() => thresholdRows(latest, metric), [latest, metric]);

  if (students.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-6 fade-in">
      {/* HEADER SECTION */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-indigo-600">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
              Toàn Khóa · 4 Môn Thi
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
              {latest.length} thí sinh
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChartIcon className="w-6 h-6 text-indigo-600" />
            Phân Bổ Năng Lực Toàn Bộ Thí Sinh
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tổng hợp dữ liệu lần thi mới nhất · Thang điểm 0–{maxSubjectVal}/môn, tổng bài thi 0–{maxTotalVal}{' '}
            {metric === 'tho' ? 'câu đúng' : 'điểm'}
          </p>
        </div>

        {/* THANG ĐIỂM SWITCHER */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-fit shadow-inner border border-slate-200/60 dark:border-slate-700">
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => onMetricChange(m.key)}
              className={`px-3.5 sm:px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                metric === m.key
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {m.short}
            </button>
          ))}
        </div>
      </div>

      {/* TOP 5 KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Card 1: Tổng thí sinh */}
        <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Tổng Thí Sinh
            </span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
              {kpis.totalStudents}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Lần thi mới nhất</p>
          </div>
        </div>

        {/* Card 2: Điểm TB Toàn Khóa */}
        <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BarChartIcon className="w-4 h-4" />
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Điểm Trung Bình
            </span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {kpis.avgTotal.toFixed(1)}{' '}
              <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Trung vị: {kpis.medTotal.toFixed(1)}</p>
          </div>
        </div>

        {/* Card 3: Thủ khoa */}
        <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Award className="w-4 h-4" />
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Điểm Cao Nhất
            </span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {kpis.maxTotal.toFixed(1)}{' '}
              <span className="text-xs font-semibold text-slate-400">/ {maxTotalVal}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Thấp nhất: {kpis.minTotal.toFixed(1)}</p>
          </div>
        </div>

        {/* Card 4: Tỷ lệ đạt ≥ 50% */}
        <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Target className="w-4 h-4" />
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Đạt ≥ 50% Điểm
            </span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 tabular-nums">
              {kpis.pass50Rate.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kpis.pass50Count}/{kpis.totalStudents} thí sinh
            </p>
          </div>
        </div>

        {/* Card 5: Giỏi & Xuất Sắc */}
        <div className="card p-4 flex flex-col justify-between hover:-translate-y-0.5 transition-transform col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Giỏi &amp; Xuất Sắc
            </span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-violet-600 dark:text-violet-400 tabular-nums">
              {kpis.good65Rate.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kpis.good65Count}/{kpis.totalStudents} thí sinh (≥ 65%)
            </p>
          </div>
        </div>
      </div>

      {/* 4-MÔN QUICK STATS STRIP */}
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-black" style={{ color }}>
                  {SUBJECT_LABEL[subj]}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Max {maxSubjectVal}</span>
              </div>
              <div className="my-1.5 flex items-baseline gap-2">
                <span className="text-xl font-black tabular-nums text-slate-800 dark:text-slate-100">
                  {s.avg.toFixed(1)}
                </span>
                <span className="text-xs font-semibold text-slate-400">
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

      {/* BIỂU ĐỒ PHÂN BỐ ĐIỂM (HISTOGRAM) */}
      <div className="card p-5 sm:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 shadow-[0_12px_40px_-5px_rgba(60,80,160,0.18)] rounded-3xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                <BarChartIcon className="w-4 h-4" />
              </span>
              Phân Bố Tần Suất Điểm Số
            </h3>
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

        <div className="h-[280px] sm:h-[340px] w-full">
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

      {/* 2 CỘT: XẾP LOẠI NĂNG LỰC & RADAR NĂNG LỰC 4 MÔN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DONUT PIE CHART: XẾP LOẠI NĂNG LỰC */}
        <div className="card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
              <span className="icon-box bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                <Award className="w-4 h-4" />
              </span>
              Xếp Loại Năng Lực Toàn Khóa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Cơ cấu 5 mức xếp loại tính trên tổng điểm 4 môn (0–{maxTotalVal})
            </p>
          </div>

          <div className="h-[280px] w-full">
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

        {/* RADAR CHART: ĐÁNH GIÁ CÂN BẰNG 4 MÔN */}
        <div className="card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
              <span className="icon-box bg-purple-50 dark:bg-purple-950/60 text-purple-600">
                <Compass className="w-4 h-4" />
              </span>
              Đánh Giá Cân Bằng Năng Lực 4 Môn
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Tỷ lệ hoàn thành trung bình của toàn khóa ở từng phân môn (%)
            </p>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} unit="%" />
                <Radar
                  name="Tỷ lệ đạt TB"
                  dataKey="Tỷ Lệ Đạt"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="#8b5cf6"
                  fillOpacity={0.45}
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

      {/* TỶ LỆ ĐẠT CÁC NGƯỠNG ĐIỂM */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
          <span className="icon-box bg-amber-50 dark:bg-amber-950/60 text-amber-600">
            <Target className="w-4 h-4" />
          </span>
          Tỷ Lệ Đạt Các Ngưỡng Chuẩn Toàn Khóa
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Tỷ lệ thí sinh vượt qua các mốc điểm quan trọng trên thang tổng {maxTotalVal}
        </p>

        <div className="h-[220px] w-full">
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
              <Bar dataKey="percent" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22}>
                <LabelList
                  dataKey="percent"
                  position="right"
                  formatter={(v: any) => `${(+v).toFixed(1)}%`}
                  style={{ fill: '#475569', fontSize: 11, fontWeight: 800 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BẢNG THỐNG KÊ PHÂN TÁN CHI TIẾT */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              Bảng Thống Kê Phân Tán Chi Tiết
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toàn bộ các chỉ số thống kê mô tả học thuật: Min, Q1, Trung vị, Q3, P90, Max, Trung bình, STĐ
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-slate-800">
          <table className="w-full text-sm text-left border-collapse border border-slate-200 dark:border-slate-700 min-w-[860px]">
            <thead className="bg-slate-100/80 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="border border-slate-200 dark:border-slate-700 px-3.5 py-3">Phần Thi / Tổng</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Số TS</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Thấp nhất</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Q1 (25%)</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center font-black">Trung vị</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Q3 (75%)</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">P90</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">Cao nhất</th>
                <th className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-center bg-indigo-50/70 dark:bg-indigo-950/40 font-black text-indigo-600 dark:text-indigo-400">
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
                    <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLOR[subj] }} />
                      <span>{SUBJECT_LABEL[subj]}</span>
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-500">
                      {d.n}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums">{d.min.toFixed(1)}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums">{d.q1.toFixed(1)}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums font-bold text-slate-800 dark:text-slate-100">
                      {d.med.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums">{d.q3.toFixed(1)}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums">{d.p90.toFixed(1)}</td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums font-bold text-emerald-600">
                      {d.max.toFixed(1)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-center tabular-nums font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20">
                      {d.avg.toFixed(2)}
                    </td>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center tabular-nums text-slate-500">
                      {d.std.toFixed(2)}
                    </td>
                  </tr>
                );
              })}

              {/* HÀNG TỔNG CỘNG TOÀN BÀI THI */}
              <tr className="bg-indigo-50/60 dark:bg-indigo-950/50 font-black text-slate-900 dark:text-white border-t-2 border-indigo-200 dark:border-indigo-800">
                <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>TỔNG TOÀN BÀI THI (4 MÔN)</span>
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.n}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.min.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.q1.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-indigo-600 dark:text-indigo-400 text-sm">
                  {stats.totals.med.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.q3.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.p90.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums text-emerald-600 text-sm">
                  {stats.totals.max.toFixed(1)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 text-center tabular-nums text-indigo-700 dark:text-indigo-300 text-sm bg-indigo-100/70 dark:bg-indigo-900/60">
                  {stats.totals.avg.toFixed(2)}
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-3 text-center tabular-nums">
                  {stats.totals.std.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
