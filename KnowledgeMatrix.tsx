import React from 'react';
import { DomainCategory, parseKnowledgeCSV, DEFAULT_KNOWLEDGE_CSV } from './lib/knowledgeStructure';

interface Props {
  onQuestionClick?: (qNum: number) => void;
  wrongQuestions?: number[];
  missingQuestions?: number[];
  topicMap?: Record<string, number[]>;
  knowledgeCsv?: string;
  domains?: DomainCategory[];
  maxQuestionNum?: number;
}

export { defaultTopicMap } from './lib/knowledgeStructure';

export function KnowledgeMatrix({
  wrongQuestions = [],
  missingQuestions = [],
  onQuestionClick,
  knowledgeCsv,
  domains: propDomains,
  maxQuestionNum = 60,
}: Props) {
  // Parse domains dynamically from CSV or prop
  const domains = React.useMemo(() => {
    if (propDomains && propDomains.length > 0) return propDomains;
    const parsed = parseKnowledgeCSV(knowledgeCsv || DEFAULT_KNOWLEDGE_CSV, maxQuestionNum);
    return parsed.domains;
  }, [propDomains, knowledgeCsv, maxQuestionNum]);

  const checkTopic = (qList: number[]) => {
    const missed = qList.filter(q => missingQuestions.includes(q));
    const wrong = qList.filter(q => wrongQuestions.includes(q));

    if (missed.length > 0 || wrong.length > 0) {
      const parts: string[] = [];
      if (wrong.length > 0) parts.push(`Sai câu ${wrong.join(', ')}`);
      if (missed.length > 0) parts.push(`Bỏ trống câu ${missed.join(', ')}`);

      const isMissingOnly = wrong.length === 0 && missed.length > 0;

      return {
        hasError: true,
        isMissingOnly,
        wrong,
        missed,
        text: `(Cần ôn lại - ${parts.join('; ')})`,
      };
    }
    return { hasError: false, isMissingOnly: false, wrong: [], missed: [], text: '' };
  };

  const getRowClass = (status: ReturnType<typeof checkTopic>) => {
    if (!status.hasError) return 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors';
    if (status.isMissingOnly) return 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors';
    return 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors';
  };

  const getCellClass = (status: ReturnType<typeof checkTopic>) => {
    if (!status.hasError) return '';
    if (status.isMissingOnly) return 'text-amber-700 dark:text-amber-400 font-bold';
    return 'text-rose-700 dark:text-rose-400 font-bold';
  };

  const getSubtitleClass = (status: ReturnType<typeof checkTopic>) => {
    if (status.isMissingOnly) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm bg-white dark:bg-slate-900/90">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider">
          <tr>
            <th className="border border-slate-200 dark:border-slate-700 px-4 py-3 w-40 text-left">Vùng Kiến Thức</th>
            <th className="border border-slate-200 dark:border-slate-700 px-4 py-3 text-left">Chuyên Đề & Tình Trạng Làm Bài</th>
            <th className="border border-slate-200 dark:border-slate-700 px-4 py-3 text-center w-32">Số Câu</th>
            <th className="border border-slate-200 dark:border-slate-700 px-4 py-3 text-left w-56">Danh Sách Câu Hỏi</th>
          </tr>
        </thead>
        <tbody className="text-slate-600 dark:text-slate-300 align-top text-xs sm:text-sm divide-y divide-slate-100 dark:divide-slate-800">
          {domains.map((dom) => {
            return dom.topics.map((topic, topicIdx) => {
              const status = checkTopic(topic.qNums);
              const isFirstTopic = topicIdx === 0;

              return (
                <tr key={`${dom.domain}-${topic.name}`} className={getRowClass(status)}>
                  {/* Domain Name (rowSpan across topics) */}
                  {isFirstTopic && (
                    <td
                      rowSpan={dom.topics.length}
                      className="border border-slate-200 dark:border-slate-700 px-3.5 py-3 font-bold text-slate-800 dark:text-slate-100 bg-slate-50/70 dark:bg-slate-800/60 align-middle"
                    >
                      <div className="flex flex-col gap-1">
                        <span className={`font-black text-xs sm:text-sm uppercase tracking-wide ${dom.color || 'text-indigo-600'}`}>
                          {dom.domain}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {dom.total} câu ({dom.qNums[0]} - {dom.qNums[dom.qNums.length - 1]})
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Topic Name & Status */}
                  <td className={`border border-slate-200 dark:border-slate-700 px-4 py-2.5 font-medium ${getCellClass(status)}`}>
                    <div className="flex items-center gap-2">
                      <span>{topic.name}</span>
                    </div>
                    {status.hasError && (
                      <div className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${getSubtitleClass(status)}`}>
                        {status.text}
                      </div>
                    )}
                  </td>

                  {/* Topic Question Count */}
                  <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                    {topic.count} câu
                  </td>

                  {/* Question Pills */}
                  <td className="border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {topic.qNums.map((q) => {
                        const isWrong = wrongQuestions.includes(q);
                        const isMissed = missingQuestions.includes(q);
                        let badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                        let symbol = '✓';
                        if (isWrong) {
                          badgeStyle = 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold';
                          symbol = '✗';
                        } else if (isMissed) {
                          badgeStyle = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold';
                          symbol = '-';
                        }

                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => onQuestionClick && onQuestionClick(q)}
                            className={`px-2 py-0.5 rounded text-[11px] border transition-transform hover:scale-110 active:scale-95 cursor-pointer flex items-center gap-1 ${badgeStyle}`}
                            title={`Câu ${q}: ${isWrong ? 'Làm sai' : isMissed ? 'Bỏ trống' : 'Làm đúng'}`}
                          >
                            <span>Câu {q}</span>
                            <span className="text-[10px] opacity-80">{symbol}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
