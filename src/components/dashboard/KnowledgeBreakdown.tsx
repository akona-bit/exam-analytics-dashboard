import React, { useMemo, useState } from 'react';
import { StudentData } from '../../types';
import { ParsedKnowledgeStructure, getTopicPerformance } from '../../lib/knowledgeStructure';
import { Check, ChevronDown, Filter, Target, X } from 'lucide-react';

interface Props {
  student: StudentData;
  structure: ParsedKnowledgeStructure;
}

type LevelFilter = 'all' | 'strong' | 'medium' | 'weak';
type SubjectTab = 'all' | 'TV' | 'TA' | 'TO' | 'TDKH';

const LEVEL_LABEL: Record<LevelFilter, string> = {
  weak: 'Cần ôn (<50%)',
  medium: 'Khá (50–79%)',
  strong: 'Tốt (≥80%)',
  all: 'Tất cả',
};

const matchLevel = (pct: number, level: LevelFilter): boolean => {
  if (level === 'weak') return pct < 50;
  if (level === 'medium') return pct >= 50 && pct < 80;
  if (level === 'strong') return pct >= 80;
  return true;
};

const pctColor = (pct: number): string => {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

const barColor = (pct: number): string => {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
};

/**
 * Phân tích theo vùng kiến thức — phiên bản gọn.
 *
 * Mặc định chỉ hiện các chuyên đề dưới 50% (việc học sinh cần làm tiếp), thay vì
 * đổ toàn bộ 3 cấp Phần thi → Nhóm → Chuyên đề ra một lúc. Bộ lọc mức độ và phần
 * thi vẫn cho phép mở rộng khi cần.
 */
export function KnowledgeBreakdown({ student, structure }: Props) {
  const [subjectTab, setSubjectTab] = useState<SubjectTab>('all');
  const [level, setLevel] = useState<LevelFilter>('weak');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (code: string) => {
    setExpandedSections(previous => {
      const next = new Set(previous);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const performance = useMemo(
    () => getTopicPerformance(structure, student.responses),
    [structure, student.responses],
  );

  const sections = useMemo(() => {
    return structure.phanThis
      .filter(pt => subjectTab === 'all' || pt.code === subjectTab)
      .map(pt => {
        const all = performance.filter(p => p.code === pt.code);
        const visible = all.filter(p => matchLevel(p.pct, level));
        const groups = new Map<string, typeof visible>();
        for (const item of visible) {
          const current = groups.get(item.groupName);
          if (current) current.push(item);
          else groups.set(item.groupName, [item]);
        }
        // Trong mỗi nhóm, đưa chuyên đề yếu nhất lên trước. Khi chưa mở rộng,
        // mỗi nhóm chỉ hiện một dòng để tránh đổ toàn bộ chuyên đề ra cùng lúc.
        for (const topics of groups.values()) {
          topics.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
        }
        const correct = all.reduce((sum, p) => sum + p.correct, 0);
        const total = all.reduce((sum, p) => sum + p.total, 0);
        const wrong = all.reduce((sum, p) => sum + p.wrong, 0);
        const missing = all.reduce((sum, p) => sum + p.missing, 0);
        return {
          pt,
          all,
          groups: Array.from(groups.entries()),
          topicCount: visible.length,
          correct,
          total,
          wrong,
          missing,
          pct: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      })
      .filter(section => section.groups.length > 0);
  }, [structure.phanThis, performance, subjectTab, level]);

  const summary = useMemo(() => {
    const pool = performance.filter(p => subjectTab === 'all' || p.code === subjectTab);
    const correct = pool.reduce((sum, p) => sum + p.correct, 0);
    const total = pool.reduce((sum, p) => sum + p.total, 0);
    const wrong = pool.reduce((sum, p) => sum + p.wrong, 0);
    const missing = pool.reduce((sum, p) => sum + p.missing, 0);
    return {
      correct,
      total,
      wrong,
      missing,
      pct: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }, [performance, subjectTab]);

  return (
    <section className="card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="icon-box bg-indigo-50 text-indigo-600">
              <Target className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-black text-slate-800 text-sm sm:text-base">
                Vùng kiến thức
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {level === 'weak'
                  ? 'Đang chỉ hiện các chuyên đề dưới 50% — phần nên ôn tiếp.'
                  : `Đang hiện: ${LEVEL_LABEL[level].toLowerCase()}.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {summary.correct}/{summary.total} đúng ({summary.pct}%)
            </span>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> {summary.wrong} sai
            </span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              {summary.missing} trống
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {([
            ['all', 'Tất cả phần'],
            ['TV', 'Tiếng Việt'],
            ['TA', 'Tiếng Anh'],
            ['TO', 'Toán'],
            ['TDKH', 'Tư duy KH'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubjectTab(key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                subjectTab === key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-slate-400 flex items-center gap-1 mr-1 text-[10.5px] font-semibold">
            <Filter className="w-3.5 h-3.5" /> Mức độ:
          </span>
          {(['weak', 'medium', 'strong', 'all'] as LevelFilter[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setLevel(key)}
              className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition-colors cursor-pointer ${
                level === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {LEVEL_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-slate-50/50 flex flex-col gap-3">
        {sections.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-slate-700">Không có chuyên đề nào trong mức này.</p>
            <p className="text-xs text-slate-500 mt-1">
              {level === 'weak'
                ? 'Bạn đang nắm tốt tất cả các vùng — thử xem mức “Tất cả” để rà lại.'
                : 'Thử đổi mức độ hoặc chọn phần thi khác.'}
            </p>
            <button
              type="button"
              onClick={() => setLevel('all')}
              className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
            >
              Xem tất cả chuyên đề
            </button>
          </div>
        ) : (
          sections.map(section => (
            <div
              key={section.pt.code}
              className={`rounded-2xl border p-3 sm:p-4 bg-white ${section.pt.borderColor || 'border-slate-200'}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black uppercase tracking-wide ${section.pt.badgeBg || 'bg-indigo-100 text-indigo-800'}`}>
                    {section.pt.code}
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                    {section.pt.name}
                  </h4>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className={`text-[11.5px] font-black tabular-nums ${pctColor(section.pct)}`}>
                    {section.correct}/{section.total} câu ({section.pct}%)
                  </span>
                  <div className="w-16 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor(section.pct)}`} style={{ width: `${section.pct}%` }} />
                  </div>
                </div>
              </div>

              {section.missing === section.total && section.total > 0 ? (
                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
                  Toàn bộ <strong>{section.total} câu</strong> của phần này chưa được làm, nên chưa có dữ liệu để phân tích chi tiết từng chuyên đề.
                </div>
              ) : (
                <>
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {section.groups.map(([groupName, topics]) => {
                      const groupRows = section.all.filter(p => p.groupName === groupName);
                      const groupCorrect = groupRows.reduce((sum, p) => sum + p.correct, 0);
                      const groupTotal = groupRows.reduce((sum, p) => sum + p.total, 0);
                      const groupPct = groupTotal > 0 ? Math.round((groupCorrect / groupTotal) * 100) : 0;
                      const isExpanded = expandedSections.has(section.pt.code);
                      const shownTopics = isExpanded ? topics : topics.slice(0, 1);

                      return (
                        <div key={`${section.pt.code}-${groupName}`} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h5 className="font-bold text-[11px] text-slate-700 truncate" title={groupName}>
                              {groupName}
                            </h5>
                            <span className={`text-[10.5px] font-bold tabular-nums shrink-0 ${pctColor(groupPct)}`}>
                              {groupCorrect}/{groupTotal} ({groupPct}%)
                            </span>
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                            <div className={`h-full ${barColor(groupPct)}`} style={{ width: `${groupPct}%` }} />
                          </div>

                          <div className="divide-y divide-slate-100">
                            {shownTopics.map(topic => (
                              <div key={`${section.pt.code}-${groupName}-${topic.name}`} className="py-1.5 flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11.5px] font-medium text-slate-700 truncate" title={topic.name}>
                                    {topic.name}
                                  </span>
                                  <span className={`text-[10.5px] font-bold tabular-nums shrink-0 ${pctColor(topic.pct)}`}>
                                    {topic.correct}/{topic.total} · {topic.pct}%
                                  </span>
                                </div>

                                {(topic.wrongQs.length > 0 || topic.missingQs.length > 0) && (
                                  <div className="flex items-center flex-wrap gap-1 text-[9.5px]">
                                    {topic.wrongQs.map(q => (
                                      <span
                                        key={`w-${q}`}
                                        className="px-1 py-0.5 rounded font-semibold bg-rose-100 text-rose-700 border border-rose-200"
                                        title={`Câu ${q}: Sai`}
                                      >
                                        C.{q} sai
                                      </span>
                                    ))}
                                    {topic.missingQs.map(q => (
                                      <span
                                        key={`m-${q}`}
                                        className="px-1 py-0.5 rounded font-semibold bg-amber-100 text-amber-700 border border-amber-200"
                                        title={`Câu ${q}: Bỏ trống`}
                                      >
                                        C.{q} trống
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {section.topicCount > section.groups.length && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.pt.code)}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] font-bold text-slate-600 transition-colors cursor-pointer"
                    >
                      {expandedSections.has(section.pt.code)
                        ? 'Thu gọn chuyên đề'
                        : `Xem thêm ${section.topicCount - section.groups.length} chuyên đề`}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedSections.has(section.pt.code) ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
