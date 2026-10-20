import React, { useMemo, useState } from 'react';
import type { QuestionData, StudentData } from '../../types';
import { quantile } from '../../lib/analytics';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════
 * Màu & cấu hình chung
 * ═══════════════════════════════════════════════════════════════════ */

type SectionKey = 'tv' | 'ta' | 'toan' | 'tdkh';

const SECTIONS: { key: SectionKey; label: string; short: string; color: string; index: number }[] = [
  { key: 'tv', label: 'Tiếng Việt', short: 'TV', color: '#4c72b0', index: 0 },
  { key: 'ta', label: 'Tiếng Anh', short: 'TA', color: '#c44e52', index: 1 },
  { key: 'toan', label: 'Toán', short: 'TO', color: '#e8a317', index: 2 },
  { key: 'tdkh', label: 'Tư duy khoa học', short: 'TDKH', color: '#4c9f70', index: 3 },
];

const AXIS = { fill: '#475569', fontSize: 11 } as const;
const AXIS_SM = { fill: '#64748b', fontSize: 10 } as const;
const GRID = '#e2e8f0';

const qNumOf = (id: string | number): number => {
  const n = Number(String(id).replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const secIndexOf = (subject: string): number => {
  const s = subject.toLowerCase();
  if (s.includes('việt')) return 0;
  if (s.includes('anh')) return 1;
  if (s.includes('toán')) return 2;
  return 3;
};

const pctOf = (q: QuestionData): number | null => {
  if (typeof q.pct === 'number' && Number.isFinite(q.pct)) {
    return q.pct > 1 ? q.pct / 100 : q.pct;
  }
  if (q.totalAttempts && typeof q.correct === 'number') {
    return q.correct / q.totalAttempts;
  }
  return null;
};

const aOf = (q: QuestionData): number =>
  typeof q.discrimination === 'number' && Number.isFinite(q.discrimination) ? q.discrimination : 1;
const bOf = (q: QuestionData): number =>
  typeof q.difficulty === 'number' && Number.isFinite(q.difficulty) ? q.difficulty : 0;

/** Xác suất đúng theo mô hình 2PL: P(θ) = 1 / (1 + e^(-1.7a(θ-b))). */
const prob = (a: number, b: number, theta: number): number =>
  1 / (1 + Math.exp(-1.7 * a * (theta - b)));

/** Hàm thông tin câu hỏi: IIF = (1.7a)² · P · (1-P). */
const info = (a: number, p: number): number => (1.7 * a) ** 2 * p * (1 - p);

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));

const thetaOf = (s: StudentData, key: SectionKey): number | null => {
  const v = s.theta?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/** Số câu đúng của một phần thi, tính trực tiếp từ 120 phản hồi. */
const correctCount = (s: StudentData, sectionIndex: number): number => {
  if (!s.responses?.length) return 0;
  const from = sectionIndex * 30 + 1;
  const to = from + 29;
  return s.responses.filter(r => r.question_num >= from && r.question_num <= to && r.status === 'correct').length;
};

/** Kernel density estimate (cùng công thức với dashboard tham chiếu). */
function kde(values: number[], xs: number[]): number[] {
  if (!values.length) return xs.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const h = 0.9 * Math.min(sd || 0.3, iqr / 1.34 || sd || 0.3) * Math.pow(values.length, -0.2) || 0.3;
  return xs.map(x =>
    values.reduce((sum, v) => sum + Math.exp(-0.5 * ((x - v) / h) ** 2), 0) /
    (values.length * h * Math.sqrt(2 * Math.PI)),
  );
}

function ChartCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  key?: React.Key;
}) {
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-slate-900">{title}</h4>
          {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 whitespace-nowrap w-fit">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 1. ICC / IIF cho một câu hỏi
 * ═══════════════════════════════════════════════════════════════════ */

interface CurvePoint {
  x: number;
  expected?: number | null;
  observed?: number | null;
  expectedInfo?: number | null;
  observedInfo?: number | null;
}

export function ItemCurveSection({ questions }: { questions: QuestionData[] }) {
  const sorted = useMemo(
    () => [...questions].sort((a, b) => qNumOf(a.id) - qNumOf(b.id)),
    [questions],
  );
  const [selected, setSelected] = useState<number>(() => {
    const withObs = sorted.find(q => q.obs && q.obs.length > 0);
    return qNumOf(withObs?.id ?? sorted[0]?.id ?? 1);
  });

  const item = useMemo(
    () => sorted.find(q => qNumOf(q.id) === selected) ?? sorted[0],
    [sorted, selected],
  );

  const a = item ? aOf(item) : 1;
  const b = item ? bOf(item) : 0;
  const pct = item ? pctOf(item) : null;

  const curveData = useMemo<CurvePoint[]>(() => {
    const xs = Array.from({ length: 121 }, (_, i) => round(-6 + i * 0.1, 2));
    const points = new Map<string, CurvePoint>();
    for (const x of xs) {
      const p = prob(a, b, x);
      points.set(String(x), { x, expected: p, expectedInfo: info(a, p) });
    }
    for (const [t, p] of item?.obs ?? []) {
      const x = round(t, 4);
      const key = String(x);
      const existing = points.get(key);
      const expected = prob(a, b, x);
      points.set(key, {
        x,
        expected: existing?.expected ?? expected,
        expectedInfo: existing?.expectedInfo ?? info(a, expected),
        observed: p,
        observedInfo: info(a, p),
      });
    }
    return [...points.values()].sort((p, q) => p.x - q.x);
  }, [a, b, item]);

  const maxInfo = useMemo(() => {
    const peak = (1.7 * a) ** 2 / 4;
    const observedMax = Math.max(0, ...(item?.obs ?? []).map(([, p]) => info(a, p)));
    return Math.max(peak, observedMax, 0.05) * 1.15;
  }, [a, item]);

  if (!item) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black">
                θ
              </span>
              Đường Cong Đặc Tính Câu Hỏi (ICC) &amp; Hàm Thông Tin (IIF)
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              So sánh đường kỳ vọng theo mô hình 2PL với tỷ lệ đúng quan sát trên 9 mốc năng lực.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 w-full lg:w-[420px]">
            Chọn câu hỏi
            <select
              value={selected}
              onChange={e => setSelected(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {sorted.map(q => {
                const n = qNumOf(q.id);
                const sec = SECTIONS[secIndexOf(q.subject)];
                return (
                  <option key={n} value={n}>
                    Câu {n} — {sec.short} — {q.topicName || q.subject}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            ['a', a.toFixed(3)],
            ['b', Number.isFinite(b) && Math.abs(b) > 10 ? b.toFixed(2) : b.toFixed(3)],
            ['% đúng', pct !== null ? `${(pct * 100).toFixed(1)}%` : '—'],
            ['D-index', item.dIndex != null ? item.dIndex.toFixed(3) : '—'],
            ['Infit', item.infit != null ? item.infit.toFixed(2) : '—'],
            ['Outfit', item.outfit != null ? item.outfit.toFixed(2) : '—'],
          ].map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
            >
              <span className="font-bold text-slate-500">{k}</span>
              <span className="font-black text-slate-800 tabular-nums">{v}</span>
            </span>
          ))}
          {(item.groupName || item.topicName) && (
            <span className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
              {item.groupName}
              {item.topicName ? ` › ${item.topicName}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title={`ICC — Câu ${qNumOf(item.id)}`}
          subtitle="Đường xanh: xác suất đúng kỳ vọng. Chấm đen: tỷ lệ đúng quan sát."
          badge={`a = ${a.toFixed(2)} · b = ${b.toFixed(2)}`}
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-6, 6]}
                  tickCount={7}
                  tick={AXIS_SM}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  label={{ value: 'θ (năng lực)', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis domain={[0, 1]} tick={AXIS_SM} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(v: number) => `θ = ${Number(v).toFixed(3)}`}
                  formatter={(value: number, name: string) => [
                    value != null ? `${(value * 100).toFixed(1)}%` : '—',
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="expected"
                  name="Kỳ vọng"
                  stroke="#4c72b0"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="observed"
                  name="Quan sát"
                  stroke="#1e293b"
                  strokeWidth={1.2}
                  dot={{ r: 3.5, fill: '#1e293b' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={`IIF — Câu ${qNumOf(item.id)}`}
          subtitle="Hàm thông tin câu hỏi: càng cao câu càng phân biệt tốt quanh mức năng lực đó."
          badge={`Đỉnh lý thuyết ${((1.7 * a) ** 2 / 4).toFixed(3)}`}
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-6, 6]}
                  tickCount={7}
                  tick={AXIS_SM}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  label={{ value: 'θ (năng lực)', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
                />
                <YAxis domain={[0, maxInfo]} tick={AXIS_SM} tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(v: number) => `θ = ${Number(v).toFixed(3)}`}
                  formatter={(value: number, name: string) => [
                    value != null ? Number(value).toFixed(4) : '—',
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="expectedInfo"
                  name="Kỳ vọng"
                  stroke="#4c72b0"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="observedInfo"
                  name="Quan sát"
                  stroke="#e03131"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3.5, fill: '#e03131' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 2. Boxplot độ khó / độ phân biệt theo phần thi
 * ═══════════════════════════════════════════════════════════════════ */

function BoxPlot({
  groups,
  yMin = 0,
  yMax = 1,
  unit = '',
}: {
  groups: { label: string; color: string; values: number[] }[];
  yMin?: number;
  yMax?: number;
  unit?: string;
}) {
  const W = 520;
  const H = 280;
  const m = { top: 12, right: 14, bottom: 42, left: 46 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;
  const y = (v: number) => m.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const step = (yMax - yMin) / 5;

  const ticks = Array.from({ length: 6 }, (_, i) => yMin + i * step);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full min-w-[420px] h-auto" role="img">
        <g fontFamily="system-ui, sans-serif">
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {t.toFixed(1)}{unit}
              </text>
            </g>
          ))}

          {groups.map((g, i) => {
            const values = g.values.filter(Number.isFinite).sort((a, b) => a - b);
            if (!values.length) return null;
            const q1 = quantile(values, 0.25);
            const med = quantile(values, 0.5);
            const q3 = quantile(values, 0.75);
            const iqr = q3 - q1;
            const loCandidates = values.filter(v => v >= q1 - 1.5 * iqr);
            const hiCandidates = values.filter(v => v <= q3 + 1.5 * iqr);
            const lo = loCandidates.length ? Math.min(...loCandidates) : q1;
            const hi = hiCandidates.length ? Math.max(...hiCandidates) : q3;
            const cx = m.left + ((i + 0.5) * plotW) / groups.length;
            const bw = (plotW / groups.length) * 0.52;

            return (
              <g key={g.label}>
                <line x1={cx} x2={cx} y1={y(lo)} y2={y(hi)} stroke={g.color} strokeWidth={1.5} />
                <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(lo)} y2={y(lo)} stroke={g.color} strokeWidth={1.5} />
                <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(hi)} y2={y(hi)} stroke={g.color} strokeWidth={1.5} />
                <rect
                  x={cx - bw / 2}
                  y={y(q3)}
                  width={bw}
                  height={Math.max(1, y(q1) - y(q3))}
                  fill={`${g.color}33`}
                  stroke={g.color}
                  strokeWidth={1.5}
                  rx={2}
                />
                <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(med)} y2={y(med)} stroke={g.color} strokeWidth={2.5} />
                {values
                  .filter(v => v < lo || v > hi)
                  .map((v, j) => (
                    <circle key={j} cx={cx} cy={y(v)} r={2.8} fill="none" stroke={g.color} strokeWidth={1.3} />
                  ))}
                <text x={cx} y={H - 18} textAnchor="middle" fontSize={10.5} fill="#475569" fontWeight={700}>
                  {g.label}
                </text>
                <text x={cx} y={H - 5} textAnchor="middle" fontSize={9.5} fill="#94a3b8">
                  n = {values.length}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function ItemQualitySection({ questions }: { questions: QuestionData[] }) {
  const grouped = useMemo(
    () =>
      SECTIONS.map(sec => {
        const items = questions.filter(q => secIndexOf(q.subject) === sec.index);
        return {
          ...sec,
          items,
          difficulties: items.map(q => pctOf(q)).filter((v): v is number => v !== null),
          ds: items.map(q => q.dIndex).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
        };
      }),
    [questions],
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartCard
        title="Độ khó CTT (tỷ lệ đúng) theo phần thi"
        subtitle="Boxplot phân bố tỷ lệ làm đúng của 30 câu mỗi phần · thang 0–1."
        badge={`${questions.length} câu`}
      >
        <BoxPlot groups={grouped.map(g => ({ label: g.label, color: g.color, values: g.difficulties }))} />
      </ChartCard>

      <ChartCard
        title="Độ phân biệt CTT (D-index, nhóm 27%) theo phần thi"
        subtitle="Boxplot D-index của từng câu · giá trị càng cao càng phân hoá tốt."
        badge="Nhóm 27% cao − 27% thấp"
      >
        <BoxPlot
          groups={grouped.map(g => ({ label: g.label, color: g.color, values: g.ds }))}
          yMin={-0.1}
          yMax={1}
        />
      </ChartCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 3. Đường cong đặc tính bài thi (TCC) + KDE năng lực/độ khó
 * ═══════════════════════════════════════════════════════════════════ */

export function TestCharacteristicSection({
  questions,
  students,
}: {
  questions: QuestionData[];
  students: StudentData[];
}) {
  const tcc = useMemo(() => {
    const xs = Array.from({ length: 121 }, (_, i) => round(-6 + i * 0.1, 2));
    return SECTIONS.map(sec => {
      const items = questions.filter(q => secIndexOf(q.subject) === sec.index);
      const line = xs.map(theta => ({
        x: theta,
        expected: items.reduce((sum, q) => sum + prob(aOf(q), bOf(q), theta), 0),
      }));

      const points = students
        .map(s => {
          const theta = thetaOf(s, sec.key);
          if (theta === null) return null;
          return { x: theta, y: correctCount(s, sec.index), id: s.sbd || s.name };
        })
        .filter((p): p is { x: number; y: number; id: string } => p !== null);

      return { ...sec, line, points };
    });
  }, [questions, students]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {tcc.map(sec => (
        <ChartCard
          key={sec.key}
          title={`TCC — ${sec.label}`}
          subtitle="Điểm thô kỳ vọng theo năng lực θ (đường) và điểm thô quan sát (chấm)."
          badge={`${sec.points.length} thí sinh`}
        >
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-6, 6]}
                  tickCount={7}
                  tick={AXIS_SM}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
                <YAxis domain={[0, 30]} tick={AXIS_SM} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(v: number) => `θ = ${Number(v).toFixed(2)}`}
                  formatter={(value: number, name: string) =>
                    name === 'Điểm thô' ? [`${value} câu`, name] : [Number(value).toFixed(1), name]
                  }
                />
                <Scatter
                  name="Điểm thô"
                  data={sec.points}
                  fill={`${sec.color}55`}
                  shape="circle"
                  isAnimationActive={false}
                  dataKey="y"
                />
                <Line
                  type="monotone"
                  data={sec.line}
                  dataKey="expected"
                  name="Kỳ vọng"
                  stroke={sec.color}
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ))}
    </div>
  );
}

export function AbilityDifficultyKdeSection({
  questions,
  students,
}: {
  questions: QuestionData[];
  students: StudentData[];
}) {
  const data = useMemo(() => {
    const xs = Array.from({ length: 121 }, (_, i) => round(-6 + i * 0.1, 2));
    return SECTIONS.map(sec => {
      const items = questions.filter(q => secIndexOf(q.subject) === sec.index);
      const thetas = students
        .map(s => thetaOf(s, sec.key))
        .filter((v): v is number => v !== null);
      const bs = items.map(q => Math.max(-6, Math.min(6, bOf(q))));
      const thetaDensity = kde(thetas, xs);
      const bDensity = kde(bs, xs);
      return {
        ...sec,
        points: xs.map((x, i) => ({
          x,
          theta: thetaDensity[i],
          difficulty: bDensity[i],
        })),
      };
    });
  }, [questions, students]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {data.map(sec => (
        <ChartCard
          key={sec.key}
          title={`Phân bố năng lực θ và độ khó b — ${sec.label}`}
          subtitle="Mật độ kernel: nét liền là năng lực thí sinh, nét đứt là độ khó 30 câu."
          badge="KDE"
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sec.points} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-6, 6]}
                  tickCount={7}
                  tick={AXIS_SM}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(v: number) => `θ / b = ${Number(v).toFixed(2)}`}
                  formatter={(value: number, name: string) => [Number(value).toFixed(4), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
                <Line
                  type="monotone"
                  dataKey="theta"
                  name="Năng lực (θ)"
                  stroke={sec.color}
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="difficulty"
                  name="Độ khó (b)"
                  stroke={sec.color}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 4. Scatter độ khó (b) – độ phân biệt (a)
 * ═══════════════════════════════════════════════════════════════════ */

export function DifficultyDiscriminationScatter({ questions }: { questions: QuestionData[] }) {
  const { groups, hidden } = useMemo(() => {
    const inRange = questions.filter(q => {
      const b = bOf(q);
      return b >= -6 && b <= 6;
    });
    return {
      groups: SECTIONS.map(sec => ({
        ...sec,
        points: inRange
          .filter(q => secIndexOf(q.subject) === sec.index)
          .map(q => ({
            x: round(bOf(q), 3),
            y: round(aOf(q), 3),
            id: qNumOf(q.id),
            subject: sec.short,
          })),
      })),
      hidden: questions.length - inRange.length,
    };
  }, [questions]);

  return (
    <ChartCard
      title="Bản đồ độ khó (b) – độ phân biệt (a) của 120 câu"
      subtitle="Mỗi điểm là một câu hỏi. Góc trên-trái: câu khó, phân biệt cao; góc dưới-phải: câu dễ, ít phân hoá."
      badge={hidden > 0 ? `${questions.length - hidden}/120 câu · ẩn ${hidden} câu có |b| > 6` : `${questions.length} câu`}
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 18, left: -12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              type="number"
              dataKey="x"
              name="Độ khó (b)"
              domain={[-4, 6]}
              tickCount={7}
              tick={AXIS_SM}
              label={{ value: 'Độ khó (b)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Độ phân biệt (a)"
              domain={[0, 'auto']}
              tick={AXIS_SM}
              label={{ value: 'Độ phân biệt (a)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
            />
            <ZAxis range={[46, 46]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value: number, name: string) => [Number(value).toFixed(3), name]}
              labelFormatter={() => ''}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { id: number; x: number; y: number; subject: string };
                return (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="font-black text-slate-800">Câu {p.id} · {p.subject}</p>
                    <p className="text-slate-500 mt-0.5">b = <span className="font-bold text-slate-700">{p.x.toFixed(3)}</span></p>
                    <p className="text-slate-500">a = <span className="font-bold text-slate-700">{p.y.toFixed(3)}</span></p>
                  </div>
                );
              }}
            />
            <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
            {groups.map(g => (
              <Scatter
                key={g.key}
                name={g.short}
                data={g.points}
                fill={g.color}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
