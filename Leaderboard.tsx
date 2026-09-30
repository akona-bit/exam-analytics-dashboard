import React, { useState } from 'react';
import { StudentData } from './types';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardProps {
  rankData: {
    tho: any[];
    irt: any[];
    tp: any[];
  };
  onSelectStudent: (student: StudentData) => void;
}

export function Leaderboard({ rankData, onSelectStudent }: LeaderboardProps) {
  const [metric, setMetric] = useState<'tp' | 'irt' | 'tho'>('tp');
  const [showAll, setShowAll] = useState(false);

  const data = rankData[metric];
  const displayData = showAll ? data : data.slice(0, 10);

  const getScore = (student: any) => {
    if (metric === 'tp') return student.totalTp;
    if (metric === 'irt') return student.totalIrt;
    return student.totalTho;
  };

  return (
    <section className="card overflow-hidden mt-6 sm:mt-8 w-full">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="icon-box bg-amber-50 text-amber-500"><Trophy className="w-[18px] h-[18px]" /></span>
          Bảng Xếp Hạng
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto overflow-x-auto w-full sm:w-auto hide-scrollbar">
          <button 
            onClick={() => setMetric('tho')} 
            className={`flex-none px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${metric === 'tho' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Điểm Thô
          </button>
          <button 
            onClick={() => setMetric('irt')} 
            className={`flex-none px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${metric === 'irt' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Điểm IRT
          </button>
          <button 
            onClick={() => setMetric('tp')} 
            className={`flex-none px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${metric === 'tp' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Thưởng Phạt
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse min-w-[500px]">
          <thead className="text-[11px] text-slate-500 bg-slate-50/80 uppercase font-semibold">
            <tr>
              <th className="px-4 py-3 border-b border-slate-100 w-16 text-center">Hạng</th>
              <th className="px-4 py-3 border-b border-slate-100">Họ và Tên</th>
              <th className="px-4 py-3 border-b border-slate-100 text-right w-32">Tổng Điểm</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((s: any, idx: number) => {
              const score = getScore(s);
              return (
                <tr 
                  key={s.email || s.name} 
                  className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                  onClick={() => onSelectStudent(s)}
                >
                  <td className="px-4 py-3 text-center">
                    {idx === 0 ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 font-bold text-xs"><Trophy className="w-3.5 h-3.5"/></span> :
                     idx === 1 ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 font-bold text-xs"><Medal className="w-3.5 h-3.5"/></span> :
                     idx === 2 ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold text-xs"><Medal className="w-3.5 h-3.5"/></span> :
                     <span className="text-slate-400 font-medium">{idx + 1}</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600 tabular-nums">
                    {score.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-center">
          <button 
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50/50 hover:bg-indigo-100 px-4 py-1.5 rounded-full"
          >
            {showAll ? 'Thu gọn' : `Xem tất cả (${data.length} thí sinh)`}
          </button>
        </div>
      )}
    </section>
  );
}
