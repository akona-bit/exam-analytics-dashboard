import { useMemo } from 'react';
import { QuestionData } from '../../types';
import { getExamCodeQuestionNum } from '../../lib/examCodesMapping';

interface Props {
  data: QuestionData[];
  selectedSubject?: string;
  examCode?: string | null;
}

/** Trích số thứ tự từ id dạng "Câu 12" hoặc "12" → 12 */
const qNumOf = (id: string): number => {
  const n = Number(String(id).replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const fmt = (v: number | null | undefined, digits = 2): string =>
  v !== null && v !== undefined && Number.isFinite(v) ? v.toFixed(digits) : '—';

const subjectStyle = (subject: string): { code: string; chip: string; text: string; bar: string } => {
  const s = (subject || '').toLowerCase();
  if (s.includes('việt')) return { code: 'TV', chip: 'bg-amber-100 text-amber-800', text: 'text-amber-600', bar: 'bg-amber-500' };
  if (s.includes('anh')) return { code: 'TA', chip: 'bg-purple-100 text-purple-800', text: 'text-purple-600', bar: 'bg-purple-500' };
  if (s.includes('toán')) return { code: 'TO', chip: 'bg-indigo-100 text-indigo-800', text: 'text-indigo-600', bar: 'bg-indigo-500' };
  return { code: 'TDKH', chip: 'bg-sky-100 text-sky-800', text: 'text-sky-600', bar: 'bg-sky-500' };
};

const pctOf = (row: QuestionData): number | null => {
  if (typeof row.pct === 'number') return row.pct * (row.pct <= 1 ? 100 : 1);
  if (row.totalAttempts && typeof row.correct === 'number') return (row.correct / row.totalAttempts) * 100;
  return null;
};

const pctClass = (pct: number | null): string => {
  if (pct === null) return 'text-slate-400';
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-rose-600';
};

/**
 * Bảng thống kê toàn bộ câu hỏi của toàn khóa.
 *
 * Mục tiêu: xem được cả 120 câu mà không phải kéo ngang hay cuộn trong một khung
 * nhỏ. Bảng desktop chỉ giữ các cột thật sự cần cho việc đọc thống kê; trên mobile
 * chuyển thành danh sách thẻ 3 dòng để mọi thông số vẫn đọc được.
 */
export function QuestionTable({ data, selectedSubject = 'all', examCode = null }: Props) {
  const showExamOrder = !!examCode;

  const filteredData = useMemo(() => {
    const base = selectedSubject === 'all' ? data : data.filter(q => q.subject === selectedSubject);
    if (!showExamOrder || !examCode) return base;
    return [...base].sort((x, y) => {
      const qx = qNumOf(x.id);
      const qy = qNumOf(y.id);
      const px = x.codePositions?.[examCode] ?? getExamCodeQuestionNum(qx, examCode);
      const py = y.codePositions?.[examCode] ?? getExamCodeQuestionNum(qy, examCode);
      return px !== py ? px - py : qx - qy;
    });
  }, [data, selectedSubject, examCode, showExamOrder]);

  return (
    <div className="w-full">
      {/* Desktop: bảng gọn, đủ cột, không cuộn ngang */}
      <div className="hidden sm:block w-full">
        <table className="w-full table-fixed text-[11px] text-left border-collapse">
          <thead className="text-[9.5px] text-slate-500 bg-slate-50 uppercase font-bold">
            <tr>
              <th className="px-2 py-2 border-b border-slate-200 w-14">Phần</th>
              <th className="px-2 py-2 border-b border-slate-200 w-20">Câu</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-20">% đúng</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-14 text-emerald-600" title="Số thí sinh làm đúng">Đúng</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-16 text-amber-600" title="Độ khó (b)">b</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-14 text-indigo-600" title="Độ phân biệt (a)">a</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-14 text-sky-700" title="D-index">D</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-14 text-teal-700" title="Infit">Infit</th>
              <th className="px-2 py-2 border-b border-slate-200 text-right w-14 text-teal-700" title="Outfit">Outfit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map(row => {
              const qNum = qNumOf(row.id);
              const pos = examCode
                ? (row.codePositions?.[examCode] ?? getExamCodeQuestionNum(qNum, examCode))
                : qNum;
              const pct = pctOf(row);
              const subject = subjectStyle(row.subject);

              return (
                <tr key={`${row.subject}-${row.id}`} className={`hover:bg-slate-50 transition-colors ${row.isError ? 'bg-rose-50/50' : ''}`}>
                  <td className="px-2 py-1.5 border-b border-slate-100 align-top">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8.5px] font-black ${subject.chip}`} title={row.subject}>
                      {subject.code}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border-b border-slate-100 align-top">
                    <span className="font-black text-indigo-600 tabular-nums">
                      {showExamOrder ? `Câu ${pos}` : `Câu ${qNum}`}
                    </span>
                    {showExamOrder && (
                      <span className="block text-[9px] text-slate-400 tabular-nums">gốc {qNum}</span>
                    )}
                  </td>
                  {row.isError ? (
                    <td colSpan={7} className="px-2 py-1.5 border-b border-slate-100 text-rose-500 font-semibold text-center text-[10px]">
                      Lỗi đề thi
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-bold tabular-nums ${pctClass(pct)}`}>
                            {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                          </span>
                          <span className="hidden lg:block w-10 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <span className={`block h-full ${pct !== null && pct >= 70 ? 'bg-emerald-500' : pct !== null && pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums font-semibold text-emerald-600 align-top">
                        {row.correct ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums font-semibold text-amber-700 align-top">
                        {fmt(row.difficulty)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums font-bold text-indigo-700 align-top">
                        {fmt(row.discrimination)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums font-semibold text-sky-700 align-top">
                        {fmt(row.dIndex, 3)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums text-teal-700 align-top">
                        {fmt(row.infit)}
                      </td>
                      <td className="px-2 py-1.5 border-b border-slate-100 text-right tabular-nums text-teal-700 align-top">
                        {fmt(row.outfit)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: thẻ câu hỏi, không có cuộn ngang */}
      <div className="sm:hidden divide-y divide-slate-100">
        {filteredData.map(row => {
          const qNum = qNumOf(row.id);
          const pos = examCode
            ? (row.codePositions?.[examCode] ?? getExamCodeQuestionNum(qNum, examCode))
            : qNum;
          const pct = pctOf(row);
          const subject = subjectStyle(row.subject);

          return (
            <div key={`m-${row.subject}-${row.id}`} className={`p-3 ${row.isError ? 'bg-rose-50/50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[11px] font-black leading-none tabular-nums">{pos}</span>
                    <span className="text-[7px] font-bold uppercase leading-none mt-0.5 text-indigo-400">câu</span>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[8.5px] font-black ${subject.chip}`}>
                        {subject.code}
                      </span>
                      {showExamOrder && (
                        <span className="text-[9.5px] text-slate-400 tabular-nums">gốc {qNum}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={row.subject}>{row.subject}</p>
                  </div>
                </div>
                <span className={`text-sm font-black tabular-nums shrink-0 ${pctClass(pct)}`}>
                  {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                </span>
              </div>

              {row.isError ? (
                <p className="mt-2 text-[10.5px] font-bold text-rose-500">⚠️ Lỗi đề thi</p>
              ) : (
                <>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${pct !== null && pct >= 70 ? 'bg-emerald-500' : pct !== null && pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 tabular-nums">
                    <span>Đúng <strong className="text-emerald-600">{row.correct ?? '—'}</strong></span>
                    <span>b <strong className="text-amber-700">{fmt(row.difficulty)}</strong></span>
                    <span>a <strong className="text-indigo-700">{fmt(row.discrimination)}</strong></span>
                    <span>D <strong className="text-sky-700">{fmt(row.dIndex, 3)}</strong></span>
                    <span>infit <strong className="text-teal-700">{fmt(row.infit)}</strong></span>
                    <span>outfit <strong className="text-teal-700">{fmt(row.outfit)}</strong></span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <p className="truncate">
          <span className="hidden sm:inline">TV Tiếng Việt · TA Tiếng Anh · TO Toán · TDKH Tư duy KH · </span>
          b độ khó · a độ phân biệt · D D-index · Infit/Outfit phù hợp IRT
        </p>
        <p className="tabular-nums shrink-0">
          {filteredData.length} câu
        </p>
      </div>
    </div>
  );
}
