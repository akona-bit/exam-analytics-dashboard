import React, { useMemo, useState } from 'react';
import { QuestionData } from '../../types';
import { getExamCodeQuestionNum } from '../../lib/examCodesMapping';
import { ChevronDown, ListChecks, SlidersHorizontal } from 'lucide-react';

interface Props {
  questions: QuestionData[];
  responses?: { question_num: number; status: string }[];
  maDe?: string | null;
}

type StatusFilter = 'all' | 'correct' | 'wrong' | 'missing';
type Status = 'correct' | 'wrong' | 'missing';

interface Row {
  q: number;
  pos: number;
  subjectCode: string;
  subjectName: string;
  topic: string;
  group: string;
  status: Status;
  pct: number | null;
  difficulty: number | null;
  discrimination: number | null;
}

const qNumOf = (id: string | number): number => {
  const n = Number(String(id).replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const subjectCodeOf = (subject: string): string => {
  const s = (subject || '').toLowerCase();
  if (s.includes('việt')) return 'TV';
  if (s.includes('anh')) return 'TA';
  if (s.includes('toán')) return 'TO';
  return 'TDKH';
};

const pctOf = (q?: QuestionData): number | null => {
  if (!q) return null;
  if (typeof q.pct === 'number' && Number.isFinite(q.pct)) {
    return q.pct > 1 ? q.pct / 100 : q.pct;
  }
  if (q.totalAttempts && typeof q.correct === 'number') {
    return q.correct / q.totalAttempts;
  }
  return null;
};

const fmt = (v: number | null | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '—';

const STATUS_STYLE: Record<Status, { label: string; short: string; chip: string; dot: string }> = {
  correct: {
    label: 'Đúng',
    short: 'Đúng',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  wrong: {
    label: 'Sai',
    short: 'Sai',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  missing: {
    label: 'Bỏ trống',
    short: 'Trống',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
};

const SUBJECT_STYLE: Record<string, { chip: string; text: string; bar: string; soft: string; hex: string }> = {
  TV: { chip: 'bg-teal-50 text-teal-700 border border-teal-200', text: 'text-teal-700', bar: 'bg-teal-500', soft: 'bg-teal-50/60', hex: '#0f766e' },
  TA: { chip: 'bg-amber-50 text-amber-700 border border-amber-200', text: 'text-amber-700', bar: 'bg-amber-500', soft: 'bg-amber-50/60', hex: '#b45309' },
  TO: { chip: 'bg-indigo-50 text-indigo-700 border border-indigo-200', text: 'text-indigo-700', bar: 'bg-indigo-500', soft: 'bg-indigo-50/60', hex: '#4338ca' },
  TDKH: { chip: 'bg-sky-50 text-sky-700 border border-sky-200', text: 'text-sky-700', bar: 'bg-sky-500', soft: 'bg-sky-50/60', hex: '#0369a1' },
};

/**
 * Bảng chi tiết toàn bộ 120 câu.
 *
 * Mặc định thu gọn trong một khung cuộn có chiều cao giới hạn để không kéo dài
 * trang; tiêu đề bảng dính khi cuộn. Nút "Mở rộng" hiển thị toàn bộ 120 dòng.
 * Các cột thông số đề (b/a/% đúng) mặc định được ẩn.
 */
export function QuestionStatsTable({ questions, responses, maDe }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [subject, setSubject] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const questionByNum = useMemo(() => {
    const map = new Map<number, QuestionData>();
    for (const q of questions) {
      const n = qNumOf(q.id);
      if (n > 0) map.set(n, q);
    }
    return map;
  }, [questions]);

  const statusByQ = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of responses || []) map.set(r.question_num, r.status);
    return map;
  }, [responses]);

  const allRows = useMemo<Row[]>(() => {
    const total = questions.length || 120;
    return Array.from({ length: total }, (_, i) => {
      const q = i + 1;
      const item = questionByNum.get(q);
      const rawStatus = statusByQ.get(q) ?? 'missing';
      const status: Status = rawStatus === 'correct' ? 'correct' : rawStatus === 'wrong' ? 'wrong' : 'missing';
      const pos = maDe
        ? item?.codePositions?.[maDe] ?? getExamCodeQuestionNum(q, maDe)
        : q;
      return {
        q,
        pos,
        subjectCode: subjectCodeOf(item?.subject ?? ''),
        subjectName: item?.subject ?? '—',
        topic: item?.topicName || item?.groupName || '—',
        group: item?.groupName || '',
        status,
        pct: pctOf(item),
        difficulty: item?.difficulty ?? null,
        discrimination: item?.discrimination ?? null,
      };
    }).sort((a, b) => a.pos - b.pos);
  }, [questions.length, questionByNum, statusByQ, maDe]);

  const counts = useMemo(
    () => ({
      correct: allRows.filter(r => r.status === 'correct').length,
      wrong: allRows.filter(r => r.status === 'wrong').length,
      missing: allRows.filter(r => r.status === 'missing').length,
    }),
    [allRows],
  );

  const rows = useMemo(
    () =>
      allRows.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (subject !== 'all' && r.subjectCode !== subject) return false;
        return true;
      }),
    [allRows, statusFilter, subject],
  );

  /** Gộp theo môn để học sinh biết mình đang ở phần nào; mỗi môn có dòng tiêu đề riêng. */
  const groups = useMemo(() => {
    const result: { code: string; name: string; rows: Row[] }[] = [];
    for (const row of rows) {
      const last = result[result.length - 1];
      if (last && last.code === row.subjectCode) last.rows.push(row);
      else result.push({ code: row.subjectCode, name: row.subjectName, rows: [row] });
    }
    return result;
  }, [rows]);

  const subjectSummary = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const row of allRows) {
      const current = map.get(row.subjectCode) || { correct: 0, total: 0 };
      current.total += 1;
      if (row.status === 'correct') current.correct += 1;
      map.set(row.subjectCode, current);
    }
    return map;
  }, [allRows]);

  const chipButton = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white shadow-xs'
        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <section id="question-detail" className="card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="icon-box bg-indigo-50 text-indigo-600">
              <ListChecks className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-black text-slate-800 text-sm sm:text-base">
                Chi tiết toàn bộ {allRows.length} câu
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Theo thứ tự trên mã đề {maDe || 'gốc'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer self-start ${
              showAdvanced
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            aria-pressed={showAdvanced}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? 'Ẩn thông số đề' : 'Thông số đề'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {([
            ['all', `Tất cả ${allRows.length}`],
            ['correct', `Đúng ${counts.correct}`],
            ['wrong', `Sai ${counts.wrong}`],
            ['missing', `Trống ${counts.missing}`],
          ] as const).map(([key, label]) => {
            const active = statusFilter === key;
            const activeColor =
              key === 'correct' ? '#059669' : key === 'wrong' ? '#e11d48' : key === 'missing' ? '#d97706' : '#4f46e5';
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={chipButton(active)}
                style={active ? { backgroundColor: activeColor, borderColor: activeColor } : undefined}
              >
                {label}
              </button>
            );
          })}

          <span className="w-px h-4 bg-slate-200 mx-1" aria-hidden="true" />

          {([
            ['all', 'Tất cả môn'],
            ['TV', 'Tiếng Việt'],
            ['TA', 'Tiếng Anh'],
            ['TO', 'Toán'],
            ['TDKH', 'Tư duy KH'],
          ] as const).map(([key, label]) => {
            const active = subject === key;
            const activeColor = key === 'all' ? '#4f46e5' : SUBJECT_STYLE[key]?.hex;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSubject(key)}
                className={chipButton(active)}
                style={active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`w-full ${
          expanded ? '' : 'max-h-[430px] sm:max-h-[480px] overflow-y-auto overscroll-contain'
        }`}
      >
        <table className="w-full table-fixed text-[10.5px] sm:text-[11px] text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 uppercase font-bold text-[9px] sm:text-[9.5px] shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th className="px-2 sm:px-3 py-1 border-b border-slate-200 text-center w-12 sm:w-16">Câu</th>
              <th className="hidden sm:table-cell px-2 sm:px-3 py-1 border-b border-slate-200 w-12 sm:w-28">Môn</th>
              <th className="px-2 sm:px-3 py-1 border-b border-slate-200">Chuyên đề</th>
              {showAdvanced && (
                <>
                  <th className="hidden sm:table-cell px-2 py-1 border-b border-slate-200 text-right w-16">% đúng</th>
                  <th className="hidden sm:table-cell px-2 py-1 border-b border-slate-200 text-right w-14">b</th>
                  <th className="hidden sm:table-cell px-2 py-1 border-b border-slate-200 text-right w-14">a</th>
                </>
              )}
              <th className="px-2 sm:px-3 py-1 border-b border-slate-200 text-center w-20 sm:w-24">Kết quả</th>
            </tr>
          </thead>

          {groups.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={showAdvanced ? 7 : 4} className="px-3 py-8 text-center text-slate-400 font-medium">
                  Không có câu nào khớp bộ lọc.
                </td>
              </tr>
            </tbody>
          ) : (
            groups.map(group => {
              const style = SUBJECT_STYLE[group.code] || SUBJECT_STYLE.TDKH;
              const summary = subjectSummary.get(group.code);
              return (
                <tbody key={group.code} className="divide-y divide-slate-100">
                  <tr className={style.soft}>
                    <td colSpan={3} className="sm:hidden px-2 py-1 border-y border-slate-100">
                      <span className={`inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-wide ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.bar}`} />
                        {group.name}
                        {summary && (
                          <span className="font-semibold normal-case tracking-normal text-slate-500">
                            {summary.correct}/{summary.total} câu
                          </span>
                        )}
                      </span>
                    </td>
                    <td colSpan={showAdvanced ? 7 : 4} className="hidden sm:table-cell px-2 sm:px-3 py-1 border-y border-slate-100">
                      <span className={`inline-flex items-center gap-2 text-[10.5px] sm:text-[11px] font-black uppercase tracking-wide ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.bar}`} />
                        {group.name}
                        {summary && (
                          <span className="font-semibold normal-case tracking-normal text-slate-500">
                            {summary.correct}/{summary.total} câu đúng
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>

                  {group.rows.map(row => {
                    const st = STATUS_STYLE[row.status];
                    return (
                      <React.Fragment key={row.q}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-2 sm:px-3 py-1 text-center align-top">
                            <span className={`block font-black tabular-nums text-[11px] sm:text-xs ${style.text}`}>
                              {row.pos}
                            </span>
                            <span className="block text-[8.5px] text-slate-400 tabular-nums">gốc {row.q}</span>
                          </td>
                          <td className="hidden sm:table-cell px-2 sm:px-3 py-1 align-top">
                            <span className={`inline-flex px-1 py-0 rounded text-[8.5px] font-black ${style.chip}`}>
                              {row.subjectCode}
                            </span>
                            <span className="hidden sm:inline ml-1.5 text-[10.5px] text-slate-600">
                              {row.subjectName}
                            </span>
                          </td>
                          <td className="px-2 sm:px-3 py-1 align-top text-slate-600">
                            <span className="block sm:truncate leading-snug" title={row.topic}>
                              {row.topic}
                            </span>
                          </td>
                          {showAdvanced && (
                            <>
                              <td className="hidden sm:table-cell px-2 py-1 text-right align-top tabular-nums font-semibold text-slate-700">
                                {row.pct !== null ? `${(row.pct * 100).toFixed(1)}%` : '—'}
                              </td>
                              <td className="hidden sm:table-cell px-2 py-1 text-right align-top tabular-nums text-slate-700">
                                {fmt(row.difficulty)}
                              </td>
                              <td className="hidden sm:table-cell px-2 py-1 text-right align-top tabular-nums text-slate-700">
                                {fmt(row.discrimination)}
                              </td>
                            </>
                          )}
                          <td className="px-2 sm:px-3 py-1 text-center align-top">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0 rounded-md border font-bold text-[9px] sm:text-[9.5px] ${st.chip}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.short}
                            </span>
                          </td>
                        </tr>
                        {showAdvanced && (
                          <tr className="sm:hidden bg-slate-50/50">
                            <td colSpan={3} className="px-2 pb-1 pt-0">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9.5px] text-slate-400 tabular-nums">
                                <span>% đúng <strong className="text-slate-600">{row.pct !== null ? `${(row.pct * 100).toFixed(1)}%` : '—'}</strong></span>
                                <span>b <strong className="text-slate-700">{fmt(row.difficulty)}</strong></span>
                                <span>a <strong className="text-slate-700">{fmt(row.discrimination)}</strong></span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              );
            })
          )}
        </table>
      </div>

      <div className="px-4 sm:px-5 py-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
        <p className="text-[10px] text-slate-400">
          <strong>Câu</strong> là vị trí trên mã đề {maDe || 'thí sinh làm'}; <strong>gốc</strong> là số thứ tự đề gốc.
          {!expanded && ' · cuộn trong khung để xem tiếp.'}
        </p>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] text-slate-400 tabular-nums">
            {rows.length}/{allRows.length} câu
            {showAdvanced ? ' · b = độ khó, a = độ phân biệt' : ''}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {expanded ? 'Thu gọn' : 'Mở rộng'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
