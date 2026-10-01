import React, { useMemo, useState } from 'react';
import { MetricKey, QuestionData, StudentData } from './types';
import {
  METRIC_LABEL, SUBJECT_LABEL, latestAttempts, attemptAverages, attemptDistribution,
  rankList, totalScore, MAX_TOTAL_SCORE,
} from './analytics';
import { QuestionTable } from './QuestionTable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell,
} from 'recharts';
import { TrendingUp, Repeat, Trophy, TrendingDown, Activity, ListFilter } from 'lucide-react';

interface Props {
  students: StudentData[];
  questions: QuestionData[];
  metric: MetricKey;
  onSelectStudent: (s: StudentData) => void;
}

const tooltipStyle = { borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' };

const BUCKET_COLORS = ['#f43f5e', '#fb7185', '#f59e0b', '#38bdf8', '#34d399'];

export function ClassAnalytics({ students, questions, metric, onSelectStudent }: Props) {
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'Toán' | 'TDKH'>('all');

  const latest = useMemo(() => latestAttempts(students), [students]);

  const trendData = useMemo(() => attemptAverages(students, metric), [students, metric]);

  const attemptData = useMemo(() => attemptDistribution(students), [students]);

  const ranking = useMemo(() => rankList(latest, metric), [latest, metric]);

  const questionStats = useMemo(() => {
    const rows = questions
      .filter(q => !q.isError && q.totalAttempts && q.totalAttempts > 0 && typeof q.correct === 'number')
      .map(q => ({
        id: q.id,
        subject: q.subject,
        attempts: q.totalAttempts as number,
        correct: q.correct as number,
        incorrect: q.incorrect ?? 0,
        ratio: (q.correct as number) / (q.totalAttempts as number),
      }));
    return rows;
  }, [questions]);

  const difficultyBuckets = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}–${i * 10 + 10}`,
      value: 0,
      fill: BUCKET_COLORS[Math.min(4, Math.floor(i / 2))],
    }));
    questionStats.forEach(q => {
      const idx = Math.min(9, Math.max(0, Math.floor(q.ratio * 10)));
      buckets[idx].value += 1;
    });
    return buckets;
  }, [questionStats]);

  const hardest = useMemo(() => [...questionStats].sort((a, b) => a.ratio - b.ratio).slice(0, 5), [questionStats]);
  const easiest = useMemo(() => [...questionStats].sort((a, b) => b.ratio - a.ratio).slice(0, 5), [questionStats]);

  const topTen = ranking.slice(0, 10);
  const bottomTen = [...ranking].reverse().slice(0, 10);

  const renderRankTable = (
    title: string,
    rows: { student: StudentData; score: number }[],
    startRank: number,
    icon: React.ReactNode,
    iconBox: string,
    scoreColor: string,
    empty: boolean
  ) => (
    <div className="card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
        <h3 className={`text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 ${empty ? 'opacity-70' : ''}`}>
          <span className={`icon-box ${iconBox}`}>{icon}</span>
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse min-w-[420px]">
          <thead className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 uppercase font-semibold">
            <tr>
              <th className="px-4 py-2.5 w-14 text-center">Hạng</th>
              <th className="px-4 py-2.5">Họ và Tên</th>
              <th className="px-4 py-2.5 text-right w-32">Tổng điểm</th>
              <th className="px-4 py-2.5 text-right w-24">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.student.email || r.student.name}
                onClick={() => onSelectStudent(r.student)}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors cursor-pointer group"
              >
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1 rounded-full text-xs font-bold ${startRank === 1 && i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>
                    {startRank === 1 ? startRank + i : ranking.length - i}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 transition-colors">{r.student.name}</td>
                <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${scoreColor}`}>{r.score.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400 dark:text-slate-500">{((r.score / MAX_TOTAL_SCORE) * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const difficultyTable = (title: string, rows: typeof hardest, color: string) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
      <p className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${color}`}>{title}</p>
      <table className="w-full text-sm text-left border-collapse">
        <tbody>
          {rows.map(q => (
            <tr key={q.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-white dark:bg-slate-800 transition-colors">
              <td className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{q.id}</td>
              <td className="px-2 py-2 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{SUBJECT_LABEL[q.subject === 'Toán' ? 'toan' : 'tdkh'] || q.subject}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[54px]">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(q.ratio * 100)}%`, background: color.includes('rose') ? '#f43f5e' : '#10b981' }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right">{(q.ratio * 100).toFixed(0)}%</span>
                </div>
              </td>
              <td className="px-4 py-2 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap">{q.correct}/{q.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (students.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section id="xu-huong" className="flex flex-col gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-emerald-50 text-emerald-600"><TrendingUp className="w-[18px] h-[18px]" /></span>
              Xu Hướng & Thống Kê Chung
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 ml-11">
              Toàn bộ số liệu theo {METRIC_LABEL[metric]} · trung bình qua từng đợt thi và cơ cấu thí sinh
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="card p-4 sm:p-5 lg:col-span-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <span className="icon-box bg-indigo-50 text-indigo-600"><Activity className="w-[18px] h-[18px]" /></span>
              Điểm Trung Bình Toàn Khóa Qua Từng Lần Thi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-4">Trung bình {METRIC_LABEL[metric]} của tất cả thí sinh ở lần thi thứ n</p>
            <div className="h-[240px] sm:h-[280px] w-full -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradToan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradTdkh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontSize: '13px' }} />
                  <Area type="monotone" dataKey="Toán" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#gradToan)" dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#6366f1' }} />
                  <Area type="monotone" dataKey="TDKH" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#gradTdkh)" dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#0ea5e9' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <span className="icon-box bg-violet-50 text-violet-600"><Repeat className="w-[18px] h-[18px]" /></span>
              Cơ Cấu Số Lần Thi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-4">Số thí sinh đã tham gia 1, 2, 3… lần thi</p>
            <div className="h-[240px] sm:h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attemptData} margin={{ top: 10, right: 10, left: -16, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="Số thí sinh" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <section id="top-ten" className="flex flex-col gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-amber-50 text-amber-600"><Trophy className="w-[18px] h-[18px]" /></span>
              Bảng Xếp Hạng {METRIC_LABEL[metric]}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 ml-11">Nhấp vào thí sinh để xem hồ sơ chi tiết</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {renderRankTable('Top 10 Điểm Cao Nhất', topTen, 1, <Trophy className="w-[18px] h-[18px]" />, 'bg-amber-50 text-amber-500', 'text-emerald-600', false)}
          {renderRankTable('Top 10 Cần Cải Thiện', bottomTen, 0, <TrendingDown className="w-[18px] h-[18px]" />, 'bg-rose-50 text-rose-500', 'text-rose-500', false)}
        </div>
      </section>

      <section id="cau-hoi" className="flex flex-col gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-rose-50 text-rose-500"><ListFilter className="w-[18px] h-[18px]" /></span>
              Phân Tích Câu Hỏi (Item Analysis)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1 ml-11">
              {questionStats.length} câu hợp lệ · phân bố tỷ lệ làm đúng và các câu dễ/khó nhất
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="card p-4 sm:p-5 lg:col-span-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <span className="icon-box bg-sky-50 text-sky-600"><Activity className="w-[18px] h-[18px]" /></span>
              Phân Bố Độ Khó Đề Thi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-4">Trục ngang: khoảng tỷ lệ làm đúng (%) · Trục dọc: số câu hỏi</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyBuckets} margin={{ top: 10, right: 10, left: -18, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={46} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" name="Số câu" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {difficultyBuckets.map((entry, i) => (
                      <Cell key={`c-${i}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4 sm:p-5 lg:col-span-2 flex flex-col gap-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-amber-50 text-amber-600"><Activity className="w-[18px] h-[18px]" /></span>
              Câu Dễ Nhất & Khó Nhất
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {difficultyTable('5 câu khó nhất', hardest, 'text-rose-500')}
              {difficultyTable('5 câu dễ nhất', easiest, 'text-emerald-600')}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="icon-box bg-indigo-50 text-indigo-600"><ListFilter className="w-[18px] h-[18px]" /></span>
                Bảng Thống Kê Từng Câu Hỏi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">Số TS đã làm, làm đúng, làm sai, bước điểm phạt và điểm thưởng của từng câu</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
              {(['all', 'Toán', 'TDKH'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSubjectFilter(s)}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectFilter === s ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200'}`}
                >
                  {s === 'all' ? 'Tất cả' : s}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto bg-white dark:bg-slate-800">
            <QuestionTable data={questions} selectedSubject={subjectFilter} />
          </div>
        </div>
      </section>
    </div>
  );
}
