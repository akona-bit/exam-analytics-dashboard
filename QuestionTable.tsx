import React from 'react';
import { QuestionData } from './types';

interface Props {
  onRowClick?: (qKey: string) => void;
  data: QuestionData[];
  selectedSubject?: string;
}

export function QuestionTable({ data, selectedSubject = 'all', onRowClick }: Props) {
  const filteredData = React.useMemo(() => {
    if (selectedSubject === 'all') return data;
    return data.filter(q => q.subject === selectedSubject);
  }, [data, selectedSubject]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
        <table className="w-full text-sm text-left border-collapse min-w-[1000px] sm:min-w-[1200px]">
          <thead className="text-xs text-slate-600 bg-slate-50 uppercase font-semibold sticky top-0 z-10 shadow-sm">
            <tr>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap">
                Phần thi
              </th>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap">
                Câu hỏi (đề gốc)
              </th>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right">
                Số TS đã làm
              </th>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-emerald-600">
                Số TS làm đúng
              </th>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-rose-600">
                Số TS làm sai
              </th>
              <th rowSpan={2} className="px-3 sm:px-4 py-3 border-r border-b border-slate-200 bg-slate-50 whitespace-nowrap text-right text-amber-600">
                Bước điểm phạt<br/><span className="text-[10px] font-medium opacity-80 normal-case">(trả lời sai hoặc không trả lời)</span>
              </th>
              <th colSpan={4} className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-slate-50 text-center text-indigo-600">
                Bước điểm thưởng
              </th>
            </tr>
            <tr>
              <th className="px-3 sm:px-4 py-2 border-r border-b border-slate-200 bg-slate-100 text-right whitespace-nowrap">
                Đúng 1 ý
              </th>
              <th className="px-3 sm:px-4 py-2 border-r border-b border-slate-200 bg-slate-100 text-right whitespace-nowrap">
                Đúng 2 ý
              </th>
              <th className="px-3 sm:px-4 py-2 border-r border-b border-slate-200 bg-slate-100 text-right whitespace-nowrap">
                Đúng 3 ý
              </th>
              <th className="px-3 sm:px-4 py-2 border-b border-slate-200 bg-slate-100 text-right whitespace-nowrap">
                Đúng
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => {
              const isFirstOfSubject = idx === 0 || filteredData[idx - 1].subject !== row.subject;
              const subjectCount = filteredData.filter(d => d.subject === row.subject).length;

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
                    <td colSpan={8} className="px-3 sm:px-4 py-3 text-rose-500 font-bold text-center bg-rose-50/30">
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
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-amber-600 font-semibold bg-amber-50/20">
                        {row.penaltyScore !== null ? row.penaltyScore.toFixed(5) : ''}
                      </td>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">
                        {row.bonus1 !== null ? row.bonus1.toFixed(5) : ''}
                      </td>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">
                        {row.bonus2 !== null ? row.bonus2.toFixed(5) : ''}
                      </td>
                      <td className="px-3 sm:px-4 py-3 border-r border-slate-100 text-right tabular-nums text-slate-600">
                        {row.bonus3 !== null ? row.bonus3.toFixed(5) : ''}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right tabular-nums font-bold text-indigo-600 bg-indigo-50/30">
                        {row.bonusCorrect !== null ? row.bonusCorrect.toFixed(5) : ''}
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
