import React, { Suspense, lazy, useMemo, useState } from 'react';
import { MetricKey, QuestionData, StudentData } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key } from 'lucide-react';
import { CelebrationOverlay } from './CelebrationOverlay';
import questionTexts from './question_texts.json';

const KnowledgeMatrix = lazy(() => import('./KnowledgeMatrix').then(m => ({ default: m.KnowledgeMatrix })));
const AbilityDistribution = lazy(() => import('./AbilityDistribution').then(m => ({ default: m.AbilityDistribution })));
const ClassAnalytics = lazy(() => import('./ClassAnalytics').then(m => ({ default: m.ClassAnalytics })));

type QuestionTextsType = { [key: string]: string };
const texts = questionTexts as QuestionTextsType;

interface Props { 
  questions: QuestionData[]; 
  students: StudentData[]; 
  examName: string; 
  topicMap?: Record<string, number[]> | null;
  questionTexts?: Record<string, string>;
  answerLink?: string;
  nextExamDate?: string;
  sbdMap?: Record<string, string>;
}

function LazyFallback() {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-sm font-medium">Đang tải...</p>
    </div>
  );
}

const maskEmail = (email: string | null | undefined) => {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const dParts = domain.split('.');
  if (dParts.length < 2) return email;
  const dName = dParts[0];
  const dExt = dParts.slice(1).join('.');
  
  const maskedName = name.length > 3 ? name.substring(0, 3) + '***' : name + '***';
  const maskedDomain = dName.length > 2 ? dName.substring(0, 1) + '***' + dName.substring(dName.length - 1) : dName + '***';
  return `${maskedName}@${maskedDomain}.${dExt}`;
};

export function Dashboard({ questions, students, examName, topicMap, questionTexts: propQuestionTexts, answerLink, nextExamDate, sbdMap }: Props) {
  const currentTexts = propQuestionTexts || texts;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSbd, setSearchSbd] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [viewQuestionKey, setViewQuestionKey] = useState<string | null>(null);
  const [progressMetric, setProgressMetric] = useState<'tho' | 'irt' | 'tp'>('tho');
  const [progressSubject, setProgressSubject] = useState<'Toán' | 'TDKH'>('Toán');
  const [showCelebration, setShowCelebration] = useState(false);
  const [classMetric, setClassMetric] = useState<MetricKey>('tho');
  const [showWrongDetail, setShowWrongDetail] = useState(false);
  const celebratedRef = React.useRef<Set<string>>(new Set());

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { type: 'empty', data: [] };
    const lowerName = searchQuery.toLowerCase();
    const lowerSbd = searchSbd.toLowerCase().trim();
    
    const nameMatches = students.filter(s => s.name.toLowerCase().includes(lowerName) || (s.email && s.email.toLowerCase().includes(lowerName)));
    
    if (nameMatches.length === 0) {
      return { type: 'not_found', data: [] };
    }

    const matches = nameMatches.filter(s => {
      const requiredSbd = sbdMap?.[s.name];
      if (requiredSbd) {
        return lowerSbd === requiredSbd.toLowerCase();
      }
      return true; // No SBD required for this student
    });

    if (matches.length === 0) {
      if (!lowerSbd) return { type: 'missing_sbd', data: [] };
      return { type: 'wrong_sbd', data: [] };
    }

    // Group by email/name and pick the latest attempt
    const latestMap = new Map<string, StudentData>();
    for (const m of matches) {
      const key = m.email || m.name;
      const ex = latestMap.get(key);
      if (!ex || m.stt > ex.stt) {
        latestMap.set(key, m);
      }
    }
    
    return { type: 'success', data: Array.from(latestMap.values()).slice(0, 5) };
  }, [students, searchQuery, searchSbd, sbdMap]);

  const classProgressData = useMemo(() => {
    const am = new Map<number, { vT: number, vD: number, c: number }>();
    const g = new Map<string, StudentData[]>();
    for (const s of students) { 
      const key = s.email || s.name;
      if (!g.has(key)) g.set(key, []); 
      g.get(key)!.push(s); 
    }
    Array.from(g.values()).forEach(sa => {
      sa.sort((a, b) => a.stt - b.stt);
      sa.forEach((a, i) => {
        const n = i + 1;
        if (!am.has(n)) am.set(n, { vT: 0, vD: 0, c: 0 });
        const d = am.get(n)!;
        const mk = progressMetric === 'tp' ? 'thuongPhat' : progressMetric;
        if (a[mk].toan !== null) d.vT += a[mk].toan;
        if (a[mk].tdkh !== null) d.vD += a[mk].tdkh;
        d.c += 1;
      });
    });
    return Array.from(am.entries()).sort((a, b) => a[0] - b[0]).map(([n, d]) => ({
      name: `Lần ${n}`, 'TB Lớp Toán': d.c ? +(d.vT/d.c).toFixed(2) : 0, 'TB Lớp TDKH': d.c ? +(d.vD/d.c).toFixed(2) : 0,
    }));
  }, [students, progressMetric]);

  const studentHistory = useMemo(() => {
    if (!selectedStudent) return [];
    const key = selectedStudent.email || selectedStudent.name;
    return students.filter(s => (s.email || s.name) === key).sort((a, b) => a.stt - b.stt);
  }, [selectedStudent, students]);

  const progressChartData = useMemo(() => {
    return studentHistory.map((s, i) => {
      const n = i + 1;
      const cd = classProgressData.find(c => c.name === `Lần ${n}`);
      const mk = progressMetric === 'tp' ? 'thuongPhat' : progressMetric;
      return {
        name: `Lần ${n}`,
        Toán: s[mk].toan || 0,
        TDKH: s[mk].tdkh || 0,
        'TB Lớp Toán': cd ? cd['TB Lớp Toán'] : 0,
        'TB Lớp TDKH': cd ? cd['TB Lớp TDKH'] : 0,
      };
    });
  }, [studentHistory, progressMetric, classProgressData]);

  const rankData = useMemo(() => {
    const groups = new Map<string, typeof students[0] & { totalTho: number, totalIrt: number, totalTp: number }>();
    for (const a of students) {
      const key = a.email || a.name;
      const ex = groups.get(key);
      const thoScore = (a.tho.toan || 0) + (a.tho.tdkh || 0);
      const irtScore = (a.irt.toan || 0) + (a.irt.tdkh || 0);
      const tpScore = (a.thuongPhat.toan || 0) + (a.thuongPhat.tdkh || 0);

      if (!ex) {
        groups.set(key, { ...a, totalTho: thoScore, totalIrt: irtScore, totalTp: tpScore });
      } else {
        ex.totalTho = Math.max(ex.totalTho, thoScore);
        ex.totalIrt = Math.max(ex.totalIrt, irtScore);
        ex.totalTp = Math.max(ex.totalTp, tpScore);
      }
    }
    const arr = Array.from(groups.values());
    return {
      tho: [...arr].sort((a, b) => b.totalTho - a.totalTho),
      irt: [...arr].sort((a, b) => b.totalIrt - a.totalIrt),
      tp: [...arr].sort((a, b) => b.totalTp - a.totalTp)
    };
  }, [students]);

  const studentRankInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const key = selectedStudent.email || selectedStudent.name;
    const rankTho = rankData.tho.findIndex(s => (s.email || s.name) === key) + 1;
    const rankIrt = rankData.irt.findIndex(s => (s.email || s.name) === key) + 1;
    const rankTp = rankData.tp.findIndex(s => (s.email || s.name) === key) + 1;
    
    return { 
      rankTho: rankTho > 0 ? rankTho : null, 
      rankIrt: rankIrt > 0 ? rankIrt : null, 
      rankTp: rankTp > 0 ? rankTp : null,
      totalTho: rankTho > 0 ? rankData.tho[rankTho - 1].totalTho : 0,
      totalIrt: rankIrt > 0 ? rankData.irt[rankIrt - 1].totalIrt : 0,
      totalTp: rankTp > 0 ? rankData.tp[rankTp - 1].totalTp : 0
    };
  }, [selectedStudent, rankData]);

  React.useEffect(() => {
    if (studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankTho === 2 || 
                            studentRankInfo.rankIrt === 1 || studentRankInfo.rankIrt === 2 || 
                            studentRankInfo.rankTp === 1 || studentRankInfo.rankTp === 2) && selectedStudent) {
      const key = selectedStudent.email || selectedStudent.name;
      if (!celebratedRef.current.has(key)) {
        setShowCelebration(true);
        celebratedRef.current.add(key);
      } else {
        setShowCelebration(false);
      }
    } else {
      setShowCelebration(false);
    }
  }, [studentRankInfo, selectedStudent]);

  const chartData = useMemo(() => {
    if (!selectedStudent) return [];
    const s = selectedStudent;
    return [
      { name: 'Điểm Thô', Toán: s.tho.toan || 0, TDKH: s.tho.tdkh || 0 },
      { name: 'Điểm IRT', Toán: s.irt.toan || 0, TDKH: s.irt.tdkh || 0 },
      { name: 'Thưởng Phạt', Toán: s.thuongPhat.toan || 0, TDKH: s.thuongPhat.tdkh || 0 },
    ];
  }, [selectedStudent]);

  const tooltipStyle = { borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' };

  if (!selectedStudent) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-[70vh] fade-in relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white mx-2 sm:mx-4"
        style={{
          backgroundImage: 'url(/bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/30 to-white/60"></div>
        
        <div className="relative z-10 w-full flex flex-col items-center p-6 sm:p-12">
          {/* Exam name header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/70 backdrop-blur-md border border-white/50 mb-6 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Tra cứu điểm thi</span>
            </div>
            
            <div className="relative inline-block">
              <h1 
                className="text-4xl sm:text-6xl md:text-7xl font-extrabold leading-tight px-4 text-blue-600 z-10 relative"
                style={{
                  fontFamily: "'Mali', cursive",
                  transform: "rotate(-2deg)",
                  WebkitTextStroke: "1px white",
                  textShadow: "2px 2px 0px white, -2px -2px 0px white, 2px -2px 0px white, -2px 2px 0px white, 0px 8px 20px rgba(37, 99, 235, 0.3)"
                }}
              >
                {examName}
              </h1>
              {/* Decorative squiggles (CSS-based to match the image vibe) */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-3 bg-blue-400/30 rounded-full blur-[2px] transform -rotate-1"></div>
            </div>
            
            <div className="mt-8">
              <p className="text-sm sm:text-base text-slate-700 font-semibold bg-white/60 backdrop-blur-md px-6 py-2.5 rounded-full inline-block shadow-sm border border-white/50">
                Nhập họ tên và số báo danh bên dưới để tra cứu
              </p>
            </div>
          </div>
          
          <div className="relative w-full max-w-3xl px-1">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Họ và tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-14 pr-12 py-4 sm:py-5 rounded-3xl border-2 border-white/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-slate-700 font-bold text-lg transition-all shadow-xl bg-white/80 backdrop-blur-xl hover:bg-white/95 focus:bg-white"
                />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
              <div className="relative flex-1 group">
                <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Số báo danh..."
                  value={searchSbd}
                  onChange={(e) => setSearchSbd(e.target.value)}
                  className="w-full pl-14 pr-12 py-4 sm:py-5 rounded-3xl border-2 border-white/80 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-slate-700 font-bold text-lg transition-all shadow-xl bg-white/80 backdrop-blur-xl hover:bg-white/95 focus:bg-white"
                />
              {searchSbd && (
                <button
                  onClick={() => setSearchSbd('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  aria-label="Clear SBD"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 transform origin-top transition-all">
              {searchResults.type === 'success' ? (
                <ul className="py-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto custom-scrollbar">
                  {searchResults.data.map((s, idx) => (
                    <li
                      key={idx}
                      onClick={() => {
                        setSelectedStudent(s);
                        setSearchQuery('');
                        setSearchSbd('');
                      }}
                      className="px-4 py-3 sm:px-6 hover:bg-indigo-50 cursor-pointer flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0 group"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 shadow-sm border border-slate-200 bg-slate-100 flex items-center justify-center group-hover:border-indigo-300 transition-colors">
                        <img 
                          src="/avatar.jpg" 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerText = s.name.charAt(0);
                            e.currentTarget.parentElement!.className = "w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-600 flex items-center justify-center font-bold text-sm sm:text-base shrink-0 shadow-sm border border-white";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-700 sm:text-lg group-hover:text-indigo-700 transition-colors">{s.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Nhấn để xem kết quả</div>
                      </div>
                      <div className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : searchResults.type === 'missing_sbd' ? (
                <div className="p-6 text-center text-amber-600 font-medium">
                  Vui lòng nhập <span className="font-bold">Số báo danh</span> để tra cứu.
                </div>
              ) : searchResults.type === 'wrong_sbd' ? (
                <div className="p-6 text-center text-rose-500 font-medium">
                  Số báo danh không đúng. Vui lòng kiểm tra lại!
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500">
                  Không tìm thấy thí sinh nào trùng tên.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 pb-8 fade-in max-w-6xl mx-auto">
      {viewQuestionKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setViewQuestionKey(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col fade-in scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{viewQuestionKey}</h3>
              <button onClick={() => setViewQuestionKey(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                {currentTexts[viewQuestionKey] || "Chưa có dữ liệu nội dung câu hỏi."}
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedStudent && studentRankInfo && (
        <CelebrationOverlay 
          show={showCelebration} 
          rank={studentRankInfo.rankTp || 1} 
          name={selectedStudent.name}
          onComplete={() => setShowCelebration(false)}
        />
      )}
      <button 
        onClick={() => setSelectedStudent(null)}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors w-fit px-3 py-1.5 -ml-3 rounded-lg hover:bg-indigo-50"
      >
        <ChevronLeft className="w-5 h-5" />
        Quay lại tìm kiếm
      </button>

      {/* Single Student Profile */}
      <section className="card p-4 sm:p-5 md:p-8 border-2 border-indigo-100 bg-white shadow-sm relative overflow-hidden">
        
        {studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 1 || studentRankInfo.rankIrt === 2 || studentRankInfo.rankTp === 1 || studentRankInfo.rankTp === 2) && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 text-amber-800 font-bold px-6 py-4 rounded-xl mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0">
                🏆
              </div>
              <div>
                <h3 className="text-lg">Chúc mừng {selectedStudent.name}!</h3>
                <p className="font-medium text-amber-700/80 text-sm">Thí sinh đạt thành tích xuất sắc (Top 2) trong đợt thi này.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:text-right">
              {studentRankInfo.rankTho && studentRankInfo.rankTho <= 2 && (
                <div className="bg-white/50 px-3 py-1.5 rounded-lg flex-1 sm:flex-none">
                  <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-0.5">Hạng Thô</div>
                  <div className="text-xl font-black text-amber-500">#{studentRankInfo.rankTho}</div>
                </div>
              )}
              {studentRankInfo.rankIrt && studentRankInfo.rankIrt <= 2 && (
                <div className="bg-white/50 px-3 py-1.5 rounded-lg flex-1 sm:flex-none">
                  <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-0.5">Hạng IRT</div>
                  <div className="text-xl font-black text-amber-500">#{studentRankInfo.rankIrt}</div>
                </div>
              )}
              {studentRankInfo.rankTp && studentRankInfo.rankTp <= 2 && (
                <div className="bg-white/50 px-3 py-1.5 rounded-lg flex-1 sm:flex-none">
                  <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mb-0.5">Hạng T.Phạt</div>
                  <div className="text-xl font-black text-amber-500">#{studentRankInfo.rankTp}</div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-100 pb-5 mb-5 mt-4 sm:mt-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 shadow-sm border-2 border-white bg-slate-100 flex items-center justify-center">
            <img 
              src="/avatar.jpg" 
              alt="Avatar" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initial if image is not found
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerText = selectedStudent.name.charAt(0);
                e.currentTarget.parentElement!.className = "w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-600 flex items-center justify-center font-bold text-2xl sm:text-3xl shrink-0 shadow-sm border border-white";
              }}
            />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{selectedStudent.name}</h2>
          </div>
          {studentRankInfo && (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="bg-indigo-50 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border border-indigo-100 text-center min-w-[80px] sm:min-w-[100px] flex-1 sm:flex-none">
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Hạng Thô</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-600">#{studentRankInfo.rankTho}</div>
                <div className="text-[10px] font-semibold text-slate-500 mt-1">Tổng: {studentRankInfo.totalTho.toFixed(2)}</div>
              </div>
              <div className="bg-sky-50 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border border-sky-100 text-center min-w-[80px] sm:min-w-[100px] flex-1 sm:flex-none">
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">Hạng IRT</div>
                <div className="text-xl sm:text-2xl font-black text-sky-600">#{studentRankInfo.rankIrt}</div>
                <div className="text-[10px] font-semibold text-slate-500 mt-1">Tổng: {studentRankInfo.totalIrt.toFixed(2)}</div>
              </div>
              <div className="bg-amber-50 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border border-amber-100 text-center min-w-[80px] sm:min-w-[100px] flex-1 sm:flex-none">
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Hạng T.Phạt</div>
                <div className="text-xl sm:text-2xl font-black text-amber-600">#{studentRankInfo.rankTp}</div>
                <div className="text-[10px] font-semibold text-slate-500 mt-1">Tổng: {studentRankInfo.totalTp.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Điểm Thô (Toán/TDKH)</p>
            <p className="text-lg sm:text-xl font-bold text-indigo-600">{selectedStudent.tho.toan ?? '-'} <span className="text-slate-300 font-normal mx-0.5">/</span> {selectedStudent.tho.tdkh ?? '-'}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-sky-200 transition-colors">
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Điểm IRT (Toán/TDKH)</p>
            <p className="text-lg sm:text-xl font-bold text-sky-600">{selectedStudent.irt.toan?.toFixed(2) ?? '-'} <span className="text-slate-300 font-normal mx-0.5">/</span> {selectedStudent.irt.tdkh?.toFixed(2) ?? '-'}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors">
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Thưởng Phạt (Toán/TDKH)</p>
            <p className="text-lg sm:text-xl font-bold text-amber-600">{selectedStudent.thuongPhat.toan?.toFixed(2) ?? '-'} <span className="text-slate-300 font-normal mx-0.5">/</span> {selectedStudent.thuongPhat.tdkh?.toFixed(2) ?? '-'}</p>
          </div>
          <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 hover:border-rose-200 transition-colors">
            <p className="text-[11px] sm:text-xs text-rose-500 font-semibold uppercase tracking-wider mb-1">Câu sai/Bỏ trống</p>
            <p className="text-lg sm:text-xl font-bold text-rose-600">
              {selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0} <span className="text-rose-300 font-normal mx-0.5">/</span> {selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0}
            </p>
          </div>
        </div>
        
        {/* Student Ability Chart */}
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 mb-4">
            <BarChartIcon className="w-5 h-5 text-indigo-500" />
            Đánh Giá Năng Lực Của Bạn So Với Lớp
          </h3>
          <div className="h-[250px] sm:h-[300px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Thô (Toán)', 'Điểm của bạn': selectedStudent.tho.toan || 0, 'Trung bình lớp': (() => { let s=0,c=0; students.forEach(x => { if(x.tho.toan !== undefined){s+=x.tho.toan;c++;} }); return c?s/c:0; })() },
                  { name: 'Thô (TDKH)', 'Điểm của bạn': selectedStudent.tho.tdkh || 0, 'Trung bình lớp': (() => { let s=0,c=0; students.forEach(x => { if(x.tho.tdkh !== undefined){s+=x.tho.tdkh;c++;} }); return c?s/c:0; })() },
                  { name: 'IRT (Toán)', 'Điểm của bạn': selectedStudent.irt.toan || 0, 'Trung bình lớp': (() => { let s=0,c=0; students.forEach(x => { if(x.irt.toan !== undefined){s+=x.irt.toan;c++;} }); return c?s/c:0; })() },
                  { name: 'IRT (TDKH)', 'Điểm của bạn': selectedStudent.irt.tdkh || 0, 'Trung bình lớp': (() => { let s=0,c=0; students.forEach(x => { if(x.irt.tdkh !== undefined){s+=x.irt.tdkh;c++;} }); return c?s/c:0; })() },
                ]}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value: number) => value.toFixed(2)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Điểm của bạn" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Trung bình lớp" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setShowWrongDetail(!showWrongDetail)}
            className="w-full p-5 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Chi tiết các câu sai và bỏ trống
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(() => {
                    const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
                    const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
                    if (wrong + missing === 0) return 'Không có lỗi sai';
                    const parts = [];
                    if (wrong > 0) parts.push(`${wrong} câu sai`);
                    if (missing > 0) parts.push(`${missing} câu bỏ trống`);
                    return parts.join(' · ') + ' — nhấp để xem chi tiết';
                  })()}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${showWrongDetail ? 'rotate-180' : ''}`} />
          </button>
          
          {showWrongDetail && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-full sm:min-w-[700px]">
              <thead className="text-xs text-slate-500 bg-slate-100/50 uppercase font-semibold">
                <tr>
                  <th className="px-3 sm:px-4 py-3 border-b border-slate-200">Câu Hỏi / Nội dung</th>
                  <th className="px-3 sm:px-4 py-3 border-b border-slate-200 w-20 sm:w-24">Trạng thái</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 text-right w-24">TS đúng</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 text-right w-24 text-rose-500">TS sai</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 text-right w-24 text-amber-600">Phạt</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudent.responses?.filter(r => r.status === 'wrong' || r.status === 'missing').sort((a,b) => a.question_num - b.question_num).map((r, i) => {
                  const qKey = `Câu ${r.question_num}`;
                  const qData = questions.find(q => q.id === qKey);
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setViewQuestionKey(qKey)}>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-bold text-slate-800 mb-1">{qKey} <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-200/50 px-1.5 py-0.5 rounded">{qData?.subject || ''}</span></div>
                        <div className="text-slate-600 text-[11px] sm:text-xs line-clamp-2">{currentTexts[qKey] || "Chưa có dữ liệu nội dung câu hỏi."}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-bold whitespace-nowrap ${r.status === 'wrong' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                          {r.status === 'wrong' ? 'Làm Sai' : 'Bỏ Trống'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{qData?.correct ?? '-'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-rose-500 font-bold">{qData?.incorrect ?? '-'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right tabular-nums text-amber-600 font-semibold bg-amber-50/10">
                        {qData?.penaltyScore !== null && qData?.penaltyScore !== undefined ? qData.penaltyScore.toFixed(4) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {(!selectedStudent.responses || selectedStudent.responses.filter(r => r.status === 'wrong' || r.status === 'missing').length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">Không có lỗi sai nào hoặc chưa có dữ liệu chi tiết.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Ma Trận Kiến Thức Cần Ôn Tập
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Phần tô <span className="text-rose-500 font-semibold">Đỏ</span>: Thí sinh làm sai. 
              Phần tô <span className="text-amber-500 font-semibold">Vàng</span>: Thí sinh bỏ trống.
            </p>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto bg-white">
            <div className="min-w-[700px]">
              <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 text-sm">Đang tải ma trận kiến thức...</div>}>
                <KnowledgeMatrix 
                  wrongQuestions={selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []} 
                  missingQuestions={selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []}
                  topicMap={topicMap || undefined}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 ${studentHistory.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        <section className="card p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="icon-box bg-indigo-50 text-indigo-600"><BarChartIcon className="w-[18px] h-[18px]" /></span>
            Điểm Số Thí Sinh
          </h2>
          <div className="h-[260px] sm:h-[300px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                <Bar dataKey="Toán" fill="#6366f1" radius={[6,6,0,0]} maxBarSize={50} />
                <Bar dataKey="TDKH" fill="#0ea5e9" radius={[6,6,0,0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {studentHistory.length > 1 && (
        <section className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="icon-box bg-rose-50 text-rose-500"><TrendingUp className="w-[18px] h-[18px]" /></span>
              Tiến Bộ Cá Nhân
            </h2>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setProgressSubject('Toán')} 
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${progressSubject === 'Toán' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Môn Toán
                </button>
                <button 
                  onClick={() => setProgressSubject('TDKH')} 
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${progressSubject === 'TDKH' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Môn TDKH
                </button>
              </div>
              <select className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={progressMetric} onChange={(e) => setProgressMetric(e.target.value as any)}>
                <option value="tho">Điểm Thô</option>
                <option value="irt">Điểm IRT</option>
                <option value="tp">Thưởng Phạt</option>
              </select>
            </div>
          </div>
          <div className="h-[280px] sm:h-[320px] w-full -ml-4 sm:-ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                
                <Area 
                  type="monotone" 
                  name={`Điểm ${progressSubject} (Cá nhân)`} 
                  dataKey={progressSubject} 
                  stroke={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9' }} 
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  name={`Trung bình lớp ${progressSubject}`} 
                  dataKey={`TB Lớp ${progressSubject}`} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={false} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        )}
      </div>
      
      {studentHistory.length > 1 && (
        <section className="card overflow-hidden mt-4 sm:mt-5 md:mt-6">
          <div className="p-4 sm:p-5 border-b border-slate-100">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="icon-box bg-emerald-50 text-emerald-600"><FileSpreadsheet className="w-[18px] h-[18px]" /></span>
              Bảng So Sánh Các Lần Thi
            </h2>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto bg-white">
            <table className="w-full text-sm text-left border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="border border-slate-200 px-3 py-2 text-center" rowSpan={2}>Lần Thi</th>
                  <th className="border border-slate-200 px-3 py-2 text-center" colSpan={3}>Toán</th>
                  <th className="border border-slate-200 px-3 py-2 text-center" colSpan={3}>TDKH</th>
                  <th className="border border-slate-200 px-3 py-2 text-center bg-indigo-50/50" rowSpan={2}>Tổng<br/>Thưởng Phạt</th>
                </tr>
                <tr>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs">Điểm Thô</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs">Điểm IRT</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs">Điểm Thô</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs">Điểm IRT</th>
                  <th className="border border-slate-200 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th>
                </tr>
              </thead>
              <tbody>
                {studentHistory.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="border border-slate-200 px-3 py-2 text-center font-bold text-slate-700">Lần {i + 1}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{s.tho.toan?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{s.irt.toan?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.toan?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{s.tho.tdkh?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center">{s.irt.tdkh?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.tdkh?.toFixed(2) ?? '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center font-bold text-indigo-600 bg-indigo-50/30">
                      {((s.thuongPhat.toan || 0) + (s.thuongPhat.tdkh || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full Analytics — moved inside student view */}
      <div className="mt-8 flex flex-col gap-8 sm:gap-10">
        <Suspense fallback={<LazyFallback />}>
          <AbilityDistribution students={students} metric={classMetric} onMetricChange={setClassMetric} />
        </Suspense>
        <Suspense fallback={<LazyFallback />}>
          <ClassAnalytics
            students={students}
            questions={questions}
            metric={classMetric}
            onSelectStudent={s => setSelectedStudent(s)}
          />
        </Suspense>
      </div>

      {/* Info Section */}
      {(answerLink || nextExamDate) && (
        <div className="mt-8 sm:mt-12 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          {nextExamDate && (
            <div className="flex items-center gap-3 text-slate-700">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Dự kiến đợt thi tiếp theo</p>
                <p className="font-bold text-slate-800 sm:text-lg">{nextExamDate}</p>
              </div>
            </div>
          )}
          {answerLink && (
            <a href={answerLink} target="_blank" rel="noopener noreferrer" className="px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto text-center flex items-center justify-center gap-2 shrink-0">
              <BookOpen className="w-5 h-5" />
              Xem Đáp Án Chi Tiết
            </a>
          )}
        </div>
      )}
    </div>
  );
}
