import React, { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { getExamCodeQuestionNum } from '../../lib/examCodesMapping';
import { getQuestionKnowledgeInfo } from '../../lib/knowledgeStructure';

interface Props {
  totalQuestions: number;
  responses?: { question_num: number; status: string }[];
  maDe?: string | null;
}

type Status = 'correct' | 'wrong' | 'missing' | 'unknown';

const SUBJECT_TEXT: Record<string, string> = {
  TV: 'text-amber-600',
  TA: 'text-purple-600',
  TO: 'text-indigo-600',
  TDKH: 'text-sky-600',
};

/**
 * Bản đồ kết quả 120 câu: chỉ giữ phần trực quan, không lặp lại bảng chi tiết.
 * Ô nhỏ, đủ màu để nhận biết nhanh đúng/sai/bỏ trống; toàn bộ nằm trong trang,
 * không có khung cuộn riêng.
 */
export function QuestionMap({ totalQuestions, responses, maDe }: Props) {
  const statusByQ = useMemo(() => {
    const map = new Map<number, Status>();
    for (const r of responses || []) {
      map.set(r.question_num, r.status === 'correct' ? 'correct' : r.status === 'wrong' ? 'wrong' : 'missing');
    }
    return map;
  }, [responses]);

  const hasResponses = (responses?.length ?? 0) > 0;

  const groups = useMemo(() => {
    const bySubject = new Map<string, { code: string; name: string; questions: number[] }>();
    for (let q = 1; q <= totalQuestions; q += 1) {
      const info = getQuestionKnowledgeInfo(q);
      const current = bySubject.get(info.subjectCode);
      if (current) current.questions.push(q);
      else bySubject.set(info.subjectCode, { code: info.subjectCode, name: info.subjectName, questions: [q] });
    }
    return Array.from(bySubject.values());
  }, [totalQuestions]);

  const counts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let missing = 0;
    for (let q = 1; q <= totalQuestions; q += 1) {
      const st = statusByQ.get(q) ?? 'missing';
      if (st === 'correct') correct += 1;
      else if (st === 'wrong') wrong += 1;
      else missing += 1;
    }
    return { correct, wrong, missing };
  }, [statusByQ, totalQuestions]);

  const cellClass = (status: Status) => {
    if (status === 'correct') return 'bg-emerald-500 text-white';
    if (status === 'wrong') return 'bg-rose-500 text-white';
    if (status === 'missing') return 'bg-amber-400 text-white';
    return 'bg-slate-200 text-slate-500';
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="icon-box bg-indigo-50 text-indigo-600">
            <LayoutGrid className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-black text-slate-800 text-sm sm:text-base">
              Bản đồ {totalQuestions} câu
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Nhìn nhanh câu đúng, sai và bỏ trống
              {maDe ? ` · Mã đề ${maDe}` : ''}
            </p>
          </div>
        </div>

        {hasResponses && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              Đúng {counts.correct}
            </span>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              Sai {counts.wrong}
            </span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              Trống {counts.missing}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5">
        {groups.map(group => {
          const groupCorrect = group.questions.filter(q => statusByQ.get(q) === 'correct').length;
          const groupTotal = group.questions.length;
          return (
            <div key={group.code} className="flex items-start gap-2 sm:gap-3">
              <div className="w-16 sm:w-24 shrink-0 pt-0.5">
                <span className={`block text-[10px] sm:text-[11px] font-black uppercase tracking-wide ${SUBJECT_TEXT[group.code] || 'text-slate-600'}`}>
                  {group.name}
                </span>
                {hasResponses && (
                  <span className="text-[9.5px] font-semibold text-slate-400 tabular-nums">
                    {groupCorrect}/{groupTotal} đúng
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 flex-1">
                {group.questions.map(q => {
                  const status = hasResponses ? (statusByQ.get(q) ?? 'missing') : 'unknown';
                  const label =
                    status === 'correct' ? 'Đúng' : status === 'wrong' ? 'Sai' : status === 'missing' ? 'Bỏ trống' : 'Chưa có dữ liệu';
                  const pos = getExamCodeQuestionNum(q, maDe);
                  return (
                    <div
                      key={q}
                      title={`Câu ${q} · Mã đề ${pos} · ${group.name}: ${label}`}
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center font-bold text-[9px] sm:text-[10px] tabular-nums ${cellClass(status)}`}
                    >
                      {q}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Đúng</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Sai</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Bỏ trống</span>
        <span className="text-slate-400">Di chuột vào ô để xem số câu trên mã đề.</span>
      </div>
    </section>
  );
}
