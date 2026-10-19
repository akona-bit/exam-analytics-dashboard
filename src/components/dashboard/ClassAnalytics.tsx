import React, { useMemo, useState, useEffect } from 'react';
import { MetricKey, QuestionData, StudentData } from '../../types';
import {
  METRIC_LABEL,
  SUBJECT_COLOR,
  latestAttempts,
  attemptAverages,
  attemptDistribution,
  rankList,
  totalMax,
  subjectScore,
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
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Repeat,
  Trophy,
  TrendingDown,
  Activity,
  ListFilter,
  CheckCircle2,
  Target,
} from 'lucide-react';

interface Props {
  students: StudentData[];
  questions: QuestionData[];
  metric: MetricKey;
}

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  fontSize: '13px',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
};

const BUCKET_COLORS = ['#f43f5e', '#fb7185', '#f59e0b', '#38bdf8', '#34d399'];

export function ClassAnalytics({ students, questions, metric }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [activeMetric, setActiveMetric] = useState<MetricKey>(metric || 'irt');

  useEffect(() => {
    if (metric) setActiveMetric(metric);
  }, [metric]);

  const subjectOptions = useMemo(() => {
    const seen: string[] = [];
    for (const q of questions) {
      if (q.subject && !seen.includes(q.subject)) seen.push(q.subject);
    }
    return seen;
  }, [questions]);

  const latest = useMemo(() => latestAttempts(students), [students]);

  const trendData = useMemo(() => attemptAverages(students, activeMetric), [students, activeMetric]);

  const attemptData = useMemo(() => attemptDistribution(students), [students]);

  const ranking = useMemo(() => rankList(latest, activeMetric), [latest, activeMetric]);

  const maxTotalScore = totalMax(activeMetric);

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

  const renderRankTable = (
    title: string,
    rows: { student: StudentData; score: number; rank: number }[],
    isTop: boolean,
    icon: React.ReactNode,
    iconBox: string,
    scoreColor: string
  ) => (
    <div className="card overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(60,80,160,0.15)] rounded-2xl">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
          <span className={`icon-box ${iconBox}`}>{icon}</span>
          <span>{title}</span>
        </h3>
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Thang {maxTotalScore} {activeMetric === 'tho' ? 'câu' : 'điểm'}
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
            {rows.map((r, i) => {
              const tv = subjectScore(r.student, activeMetric, 'tv') ?? 0;
              const ta = subjectScore(r.student, activeMetric, 'ta') ?? 0;
              const toan = subjectScore(r.student, activeMetric, 'toan') ?? 0;
              const tdkh = subjectScore(r.student, activeMetric, 'tdkh') ?? 0;
              const pct = Math.min(100, Math.round((r.score / maxTotalScore) * 100));

              return (
                <tr
                  key={r.student.sbd || r.student.email || r.student.name}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-black ${
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
                  <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                    <div>{r.student.name}</div>
                    {r.student.sbd && (
                      <div className="text-[10px] text-slate-400 font-normal">SBD: {r.student.sbd}</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{tv}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{ta}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{toan}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400 font-medium">{tdkh}</td>
                  <td className={`px-3 py-2.5 text-right font-black tabular-nums text-sm ${scoreColor}`}>
                    {r.score.toFixed(0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500 font-semibold">
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

  const difficultyTable = (title: string, rows: typeof hardest, color: string) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <p className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${color}`}>
        {title}
      </p>
      <table className="w-full text-sm text-left border-collapse">
        <tbody>
          {rows.map(q => (
            <tr
              key={q.id}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {q.id}
              </td>
              <td className="px-2 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{q.subject}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(q.ratio * 100)}%`,
                        background: color.includes('rose') ? '#f43f5e' : '#10b981',
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300 w-10 text-right">
                    {(q.ratio * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-[11px] tabular-nums text-slate-400 whitespace-nowrap">
                {q.correct}/{q.attempts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (students.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 fade-in">
      {/* SECTION 1: XU HƯỚNG & TIẾN BỘ QUA TỪNG LẦN THI */}
      <section id="xu-huong" className="flex flex-col gap-4">
        <div className="card p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-l-4 border-l-emerald-500">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              Xu Hướng &amp; Thống Kê Toàn Khóa
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Điểm trung bình toàn bộ 4 môn thi qua từng đợt và cơ cấu số lần tham gia
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Trend Area Chart (4 Môn) */}
          <div className="card p-5 lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                  <Activity className="w-4 h-4" />
                </span>
                Điểm Trung Bình 4 Môn Qua Từng Lần Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Điểm trung bình theo {METRIC_LABEL[metric]} của tất cả thí sinh ở lần thi thứ n
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
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span className="icon-box bg-violet-50 dark:bg-violet-950/60 text-violet-600">
                  <Repeat className="w-4 h-4" />
                </span>
                Cơ Cấu Số Lần Thi
              </h3>
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

      {/* SECTION 2: BẢNG XẾP HẠNG TOÀN KHÓA */}
      <section id="top-ten" className="flex flex-col gap-4">
        <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-amber-500 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/90 dark:border-slate-800 rounded-2xl shadow-sm">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Bảng Xếp Hạng Toàn Khóa (Đủ 4 Môn)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {activeMetric === 'irt'
                ? 'Xếp hạng theo mô hình chuẩn hóa IRT Thang 1200 (Chuẩn ĐGNL ĐHQG-HCM Đợt 1)'
                : 'Xếp hạng theo tổng số câu trả lời đúng (Thang tối đa: 120 câu)'}
            </p>
          </div>

          {/* Metric Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveMetric('irt')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeMetric === 'irt'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Chuẩn hoá IRT (1200đ - Chuẩn VNU-HCM Đợt 1)
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('tho')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                activeMetric === 'tho'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Điểm Thô (120 câu)
            </button>
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

      {/* SECTION 3: PHÂN TÍCH CÂU HỎI (ITEM ANALYSIS) */}
      <section id="cau-hoi" className="flex flex-col gap-4">
        <div className="card p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-l-4 border-l-rose-500">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ListFilter className="w-6 h-6 text-rose-500" />
              Phân Tích Câu Hỏi (Item Analysis)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {questionStats.length} câu hỏi hợp lệ · Độ phân hóa, tỷ lệ làm đúng và câu hỏi tiêu biểu
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Difficulty Buckets */}
          <div className="card p-5 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span className="icon-box bg-sky-50 dark:bg-sky-950/60 text-sky-600">
                  <Activity className="w-4 h-4" />
                </span>
                Phân Bố Độ Khó Đề Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Số lượng câu hỏi theo tỷ lệ làm đúng (%)
              </p>
            </div>

            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyBuckets} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={40}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="Số câu" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {difficultyBuckets.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hardest & Easiest */}
          <div className="card p-5 lg:col-span-2 flex flex-col gap-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              Top Câu Hỏi Khó Nhất &amp; Dễ Nhất
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {difficultyTable('5 câu có tỷ lệ đúng thấp nhất (Khó)', hardest, 'text-rose-500')}
              {difficultyTable('5 câu có tỷ lệ đúng cao nhất (Dễ)', easiest, 'text-emerald-600')}
            </div>
          </div>
        </div>

        {/* FULL QUESTION TABLE */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="icon-box bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                  <ListFilter className="w-4 h-4" />
                </span>
                Bảng Thống Kê Chi Tiết Toàn Bộ 120 Câu Hỏi
              </h3>
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

          <div className="max-h-[560px] overflow-y-auto bg-white dark:bg-slate-800">
            <QuestionTable data={questions} selectedSubject={subjectFilter} />
          </div>
        </div>
      </section>
    </div>
  );
}
