import React, { useMemo } from 'react';
import { MetricKey, StudentData, SubjectKey } from './types';
import {
  ABILITY_BANDS, METRIC_LABEL, SUBJECT_LABEL, latestAttempts, describe, sortedScores,
  thresholdRows, totalScore, subjectScore, bandOf, MAX_TOTAL_SCORE,
} from './analytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ReferenceLine, LabelList,
} from 'recharts';
import { BarChart as BarChartIcon, TrendingUp, Award, FileSpreadsheet, Users, Target } from 'lucide-react';

interface Props {
  students: StudentData[];
  metric: MetricKey;
  onMetricChange: (m: MetricKey) => void;
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'tho', label: METRIC_LABEL.tho },
  { key: 'irt', label: METRIC_LABEL.irt },
  { key: 'thuongPhat', label: METRIC_LABEL.thuongPhat },
];

const BIN_SIZE = 2.5;
const BIN_COUNT = 10;

const tooltipStyle = { borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' };

export function AbilityDistribution({ students, metric, onMetricChange }: Props) {
  const latest = useMemo(() => latestAttempts(students), [students]);

  const stats = useMemo(() => {
    const toan = describe(sortedScores(latest, metric, 'toan'));
    const tdkh = describe(sortedScores(latest, metric, 'tdkh'));
    const totals = latest.map(s => totalScore(s, metric));
    return { toan, tdkh, totals };
  }, [latest, metric]);

  const kpis = useMemo(() => {
    const reached = stats.totals.filter(v => v >= MAX_TOTAL_SCORE * 0.6).length;
    return {
      total: latest.length,
      avgToan: stats.toan.avg,
      avgTdkh: stats.tdkh.avg,
      medTotal: stats.totals.length ? [...stats.totals].sort((a, b) => a - b)[Math.floor(stats.totals.length / 2)] : 0,
      pct60: latest.length ? (reached / latest.length) * 100 : 0,
      reached,
    };
  }, [latest, stats]);

  const histogramData = useMemo(() => {
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
      label: `${+(i * BIN_SIZE).toFixed(2)}`,
      'Toán': 0,
      'TDKH': 0,
    }));
    for (const s of latest) {
      (['toan', 'tdkh'] as SubjectKey[]).forEach(subj => {
        const v = subjectScore(s, metric, subj);
        if (v === null) return;
        const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(v / BIN_SIZE)));
        bins[idx][SUBJECT_LABEL[subj] as 'Toán' | 'TDKH'] += 1;
      });
    }
    return bins;
  }, [latest, metric]);

  const bandData = useMemo(() => {
    const counts = ABILITY_BANDS.map(b => ({ name: b.label, value: 0, color: b.color }));
    for (const s of latest) {
      const idx = bandOf(totalScore(s, metric));
      if (idx >= 0) counts[idx].value += 1;
    }
    return counts;
  }, [latest, metric]);

  const scatterData = useMemo(() => latest
    .map(s => {
      const toan = subjectScore(s, metric, 'toan');
      const tdkh = subjectScore(s, metric, 'tdkh');
      if (toan === null || tdkh === null) return null;
      return { name: s.name, toan, tdkh };
    })
    .filter((d): d is { name: string; toan: number; tdkh: number } => d !== null), [latest, metric]);

  const thresholdData = useMemo(() => thresholdRows(latest, metric), [latest, metric]);

  const renderBandLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const rad = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * rad);
    const y = cy + r * Math.sin(-midAngle * rad);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (students.length === 0) return null;

  const kpiCards = [
    { label: 'Tổng thí sinh', value: String(kpis.total), note: 'lần thi mới nhất', icon: <Users className="w-5 h-5" />, box: 'bg-indigo-50 text-indigo-600', accent: 'text-indigo-600' },
    { label: `TB ${METRIC_LABEL[metric]} Toán`, value: kpis.avgToan.toFixed(2), note: `trung vị ${stats.toan.med.toFixed(2)}`, icon: <BarChartIcon className="w-5 h-5" />, box: 'bg-indigo-50 text-indigo-600', accent: 'text-indigo-600' },
    { label: `TB ${METRIC_LABEL[metric]} TDKH`, value: kpis.avgTdkh.toFixed(2), note: `trung vị ${stats.tdkh.med.toFixed(2)}`, icon: <BarChartIcon className="w-5 h-5" />, box: 'bg-sky-50 text-sky-600', accent: 'text-sky-600' },
    { label: 'Trung vị tổng điểm', value: kpis.medTotal.toFixed(1), note: `trên thang ${MAX_TOTAL_SCORE}`, icon: <Award className="w-5 h-5" />, box: 'bg-emerald-50 text-emerald-600', accent: 'text-emerald-600' },
    { label: 'Tỷ lệ đạt ≥ 60%', value: `${kpis.pct60.toFixed(1)}%`, note: `${kpis.reached}/${kpis.total} thí sinh`, icon: <Target className="w-5 h-5" />, box: 'bg-amber-50 text-amber-600', accent: 'text-amber-600' },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="icon-box bg-indigo-50 text-indigo-600"><BarChartIcon className="w-[18px] h-[18px]" /></span>
            Phân Bổ Năng Lực Toàn Bộ Thí Sinh
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 ml-11">
            Lấy lần thi mới nhất của {latest.length} thí sinh · Thang điểm 0–25/môn, tổng {MAX_TOTAL_SCORE}
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit shadow-inner">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => onMetricChange(m.key)}
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${metric === m.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpiCards.map((k, i) => (
          <div key={i} className="card p-4 flex flex-col gap-2 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.box}`}>{k.icon}</span>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider leading-tight">{k.label}</p>
            </div>
            <p className={`text-2xl font-black tabular-nums ${k.accent}`}>{k.value}</p>
            <p className="text-[11px] text-slate-400 font-medium">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="icon-box bg-sky-50 text-sky-600"><BarChartIcon className="w-[18px] h-[18px]" /></span>
            Phân Bố {METRIC_LABEL[metric]}
          </h3>
          <p className="text-xs text-slate-500">
            Trung bình: <span className="font-semibold text-indigo-600">Toán {stats.toan.avg.toFixed(2)}</span> ·{' '}
            <span className="font-semibold text-sky-600">TDKH {stats.tdkh.avg.toFixed(2)}</span>
          </p>
        </div>
        <p className="text-xs text-slate-500 mb-4">Trục ngang: khoảng điểm (bước 2.5) · Trục dọc: số thí sinh trong khoảng điểm đó</p>
        <div className="h-[260px] sm:h-[320px] w-full -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} interval={0} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontSize: '13px' }} />
              <Bar dataKey="Toán" name="Toán" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="TDKH" name="TDKH" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
            <span className="icon-box bg-emerald-50 text-emerald-600"><Award className="w-[18px] h-[18px]" /></span>
            Xếp Loại Năng Lực
          </h3>
          <p className="text-xs text-slate-500 mb-2">Tổng điểm Toán + TDKH ({METRIC_LABEL[metric]}) chia theo 5 mức</p>
          <div className="h-[260px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bandData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                  label={renderBandLabel}
                  labelLine={false}
                >
                  {bandData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value} thí sinh`, name]} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value: any, entry: any) => {
                    const count = entry?.payload?.value;
                    return `${entry?.payload?.name ?? value}${typeof count === 'number' ? ` — ${count} TS` : ''}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
            <span className="icon-box bg-rose-50 text-rose-500"><TrendingUp className="w-[18px] h-[18px]" /></span>
            Mối Quan Hệ Toán – TDKH
          </h3>
          <p className="text-xs text-slate-500 mb-2">Mỗi điểm là một thí sinh · Đường nét nét đứt là trung bình {METRIC_LABEL[metric]}</p>
          <div className="h-[260px] sm:h-[280px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" dataKey="toan" name="Toán" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 26]} />
                <YAxis type="number" dataKey="tdkh" name="TDKH" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 26]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div style={tooltipStyle} className="bg-white px-3 py-2">
                        <div className="font-semibold text-slate-700 text-xs mb-1">{p.name}</div>
                        <div className="text-indigo-600 text-xs">Toán: {p.toan.toFixed(2)}</div>
                        <div className="text-sky-600 text-xs">TDKH: {p.tdkh.toFixed(2)}</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={stats.tdkh.avg} stroke="#cbd5e1" strokeDasharray="5 5" />
                <ReferenceLine x={stats.toan.avg} stroke="#cbd5e1" strokeDasharray="5 5" />
                <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
            <span className="icon-box bg-amber-50 text-amber-600"><Target className="w-[18px] h-[18px]" /></span>
            Tỷ Lệ Đạt Ngưỡng Điểm
          </h3>
          <p className="text-xs text-slate-500 mb-4">Tỷ lệ thí sinh có tổng điểm {METRIC_LABEL[metric]} đạt từng ngưỡng trên thang {MAX_TOTAL_SCORE}</p>
          <div className="h-[220px] sm:h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={thresholdData} layout="vertical" margin={{ top: 5, right: 56, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={92} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, _n: any, p: any) => [`${(+v).toFixed(1)}% (${p.payload.count} TS)`, 'Tỷ lệ']} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="percent" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={20}>
                  <LabelList dataKey="percent" position="right" formatter={(v: any) => `${(+v).toFixed(0)}%`} style={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
            <span className="icon-box bg-violet-50 text-violet-600"><Users className="w-[18px] h-[18px]" /></span>
            Tổng Quan Phân Tán
          </h3>
          <p className="text-xs text-slate-500 mb-4">Đại lượng tóm tắt mức năng lực toàn bộ thí sinh ({METRIC_LABEL[metric]})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              ['Trung bình Toán', stats.toan.avg.toFixed(2), 'text-indigo-600'],
              ['Trung bình TDKH', stats.tdkh.avg.toFixed(2), 'text-sky-600'],
              ['STĐ Toán', stats.toan.std.toFixed(2), 'text-indigo-600'],
              ['STĐ TDKH', stats.tdkh.std.toFixed(2), 'text-sky-600'],
              ['Cao nhất (tổng)', (stats.toan.max + stats.tdkh.max).toFixed(2), 'text-emerald-600'],
              ['Thấp nhất (tổng)', (stats.toan.min + stats.tdkh.min).toFixed(2), 'text-rose-600'],
            ] as [string, string, string][]).map(([label, value, color]) => (
              <div key={label} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-lg font-black tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="icon-box bg-amber-50 text-amber-600"><FileSpreadsheet className="w-[18px] h-[18px]" /></span>
            Thống Kê Phân Tán Chi Tiết {METRIC_LABEL[metric]}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Min · Q1 · Trung vị · Q3 · Q90 · Max · Trung bình · Độ lệch chuẩn của từng môn</p>
        </div>
        <div className="p-4 sm:p-5 overflow-x-auto bg-white">
          <table className="w-full text-sm text-left border-collapse border border-slate-200 min-w-[820px]">
            <thead className="bg-slate-100 text-slate-700 font-semibold">
              <tr>
                <th className="border border-slate-200 px-3 py-2">Môn</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Số TS</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Thấp nhất</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Q1 (25%)</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Trung vị</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Q3 (75%)</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Q90</th>
                <th className="border border-slate-200 px-3 py-2 text-center">Cao nhất</th>
                <th className="border border-slate-200 px-3 py-2 text-center bg-indigo-50/50">Trung bình</th>
                <th className="border border-slate-200 px-3 py-2 text-center">STĐ</th>
              </tr>
            </thead>
            <tbody>
              {(['toan', 'tdkh'] as SubjectKey[]).map(subj => {
                const d = subj === 'toan' ? stats.toan : stats.tdkh;
                const isToan = subj === 'toan';
                return (
                  <tr key={subj} className="hover:bg-slate-50 transition-colors">
                    <td className={`border border-slate-200 px-3 py-2 font-bold ${isToan ? 'text-indigo-600' : 'text-sky-600'}`}>{SUBJECT_LABEL[subj]}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums text-slate-500">{d.n}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{d.min.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{d.q1.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums font-semibold">{d.med.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{d.q3.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{d.p90.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{d.max.toFixed(2)}</td>
                    <td className={`border border-slate-200 px-3 py-2 text-center tabular-nums font-bold ${isToan ? 'text-indigo-600 bg-indigo-50/30' : 'text-sky-600 bg-sky-50/30'}`}>{d.avg.toFixed(2)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums text-slate-600">{d.std.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
