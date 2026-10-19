import React from 'react';
import { QuestionData } from '../../types';

interface Props {
  data: QuestionData[];
  selectedSubject?: string;
}

export function QuestionTable({ data, selectedSubject = 'all' }: Props) {
  const filteredData = React.useMemo(() => {
    if (selectedSubject === 'all') return data;
    return data.filter(q => q.subject === selectedSubject);
  }, [data, selectedSubject]);

  /** Hiển thị tham số IRT, để trống ô khi thiếu dữ liệu. */
  const fmt = (v: number | null): string =>
    v !== null && Number.isFinite(v) ? v.toFixed(5) : '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
        <table className="w-full text-sm text-left border-collapse min-w-[820px] sm:min-w-[980px]">
          <thead className="text-xs text-slate-600 bg-slate-50 uppercase font-semibold sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap">
                Phần thi
              </th>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap">
                Câu hỏi (đề gốc)
              </th>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right">
                Số TS đã làm
              </th>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-emerald-600">
                Số TS làm đúng
              </th>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-rose-600">
                Số TS làm sai
              </th>
              <th className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-amber-600">
                Độ khó<br /><span className="text-[10px] font-medium opacity-80 normal-case">(b)</span>
              </th>
              <th className="px-3 sm:px-4 py-3 border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-indigo-600">
                Độ phân biệt<br /><span className="text-[10px] font-medium opacity-80 normal-case">(a)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const isFirstOfSubject = idx === 0 || filteredData[idx - 1].subject !== row.subject;
              const subjectCount = filteredData.filter(d => d.subject === row.subject).length;
              // Hàng "LỖI ĐỀ THI" phải phủ nốt đúng số cột còn lại: 5 cột số liệu +
              // 1 cột "Phần thi" nếu ô này không được render (đã nằm ở rowSpan phía trên).
              const errorSpan = 5 + (isFirstOfSubject ? 0 : 1);

              return (
                <tr 
                  key={`${row.subject}-${row.id}-${idx}`} 
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${row.isError ? 'bg-rose-50/50 hover:bg-rose-100/50' : 'bg-white'}`}
                >
                  {isFirstOfSubject && (
                    <td 
                      rowSpan={subjectCount} 
                      className="px-3 sm:px-4 py-3 border-r border-slate-200 bg-slate-50/50 font-bold text-slate-800 align-top"
                    >
                      {row.subject}
                    </td>
                  )}
                  <td className="px-3 sm:px-4 py-3 border-r border-slate-100 font-semibold text-slate-700">
                    {row.id}
                  </td>
                  
                  {row.isError ? (
                    <td colSpan={errorSpan} className="px-3 sm:px-4 py-3 text-rose-500 font-bold text-center bg-rose-50/30">
                      ⚠️ LỖI ĐỀ THI
                    </td>
                  ) : (
                    <>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">
                        {row.totalAttempts}
                      </td>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-emerald-600">
                        {row.correct}
                      </td>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums font-semibold text-rose-500">
                        {row.incorrect}
                      </td>
                      <td
                        title={row.difficulty !== null ? String(row.difficulty) : undefined}
                        className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-amber-600 font-semibold bg-amber-50/20"
                      >
                        {fmt(row.difficulty)}
                      </td>
                      <td
                        title={row.discrimination !== null ? String(row.discrimination) : undefined}
                        className="px-3 sm:px-4 py-3 text-right tabular-nums font-bold text-indigo-600 bg-indigo-50/30"
                      >
                        {fmt(row.discrimination)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
