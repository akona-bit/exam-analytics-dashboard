import React, { Suspense, lazy, useMemo, useState } from 'react';
import { ExamType, MetricKey, QuestionData, StudentData } from './types';
import { EXAM_TYPES, EXAM_TYPE_LABEL, countByExamType, examTypeOf, filterByExamType } from './analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key, Target, PieChart as PieChartIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
import { CelebrationOverlay } from './CelebrationOverlay';
import questionTexts from './question_texts.json';

const KnowledgeMatrix = lazy(() => import('./KnowledgeMatrix').then(m => ({ default: m.KnowledgeMatrix })));
import { defaultTopicMap } from './KnowledgeMatrix';
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
  visibleParts?: { tv: boolean; ta: boolean; toan: boolean; tdkh: boolean };
}

function LazyFallback() {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
      <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-sm font-medium">Đang tải...</p>
    </div>
  );
}

function ExamTypeTabs({ active, onChange, counts }: { active: ExamType; onChange: (t: ExamType) => void; counts: Record<ExamType, number> }) {
  const visible = EXAM_TYPES.filter(t => counts[t] > 0);
  if (visible.length < 2) return null;
  return (
    <div className="w-full flex justify-center">
      <div role="tablist" className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm max-w-full overflow-x-auto">
        {visible.map(t => {
          const on = t === active;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(t)}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all whitespace-nowrap ${
                on
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
              }`}
            >
              {EXAM_TYPE_LABEL[t]}
              <span className={`ml-2 text-xs font-black tabular-nums ${on ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                {counts[t].toLocaleString('vi-VN')}
              </span>
            </button>
          );
        })}
      </div>
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

export function Dashboard({ questions, students, examName, topicMap, questionTexts: propQuestionTexts, answerLink, nextExamDate, sbdMap, visibleParts }: Props) {
  const currentTexts = propQuestionTexts || texts;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [viewQuestionKey, setViewQuestionKey] = useState<string | null>(null);
  const [progressMetric, setProgressMetric] = useState<'tho' | 'irt' | 'tp'>('tho');
  const [progressSubject, setProgressSubject] = useState<'Toán' | 'TDKH'>('Toán');
  const [showCelebration, setShowCelebration] = useState(false);
  const [classMetric, setClassMetric] = useState<MetricKey>('tho');
  const [showWrongDetail, setShowWrongDetail] = useState(false);
  const [examType, setExamType] = useState<ExamType>('survey');
  const [studentTab, setStudentTab] = useState<'overview' | 'review' | 'history' | 'class'>('overview');
  const [radarMode, setRadarMode] = useState<'compare' | 'parts'>('compare');
  const celebratedRef = React.useRef<Set<string>>(new Set());

  const examCounts = useMemo(() => countByExamType(students), [students]);
  const activeStudents = useMemo(() => filterByExamType(students, examType), [students, examType]);
  const activeQuestions = useMemo(() => filterByExamType(questions, examType), [questions, examType]);

  const handleExamTypeChange = (next: ExamType) => {
    setSearchQuery('');
    setViewQuestionKey(null);
    setSelectedStudent(prev => {
      if (!prev) return null;
      const key = prev.email || prev.name;
      return students.find(s => examTypeOf(s) === next && (s.email || s.name) === key) || null;
    });
    setExamType(next);
  };

  const autoCompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const lowerName = searchQuery.toLowerCase();
    const nameMatches = activeStudents.filter(s => s.name.toLowerCase().includes(lowerName) || (s.email && s.email.toLowerCase().includes(lowerName)));
    // Get unique names
    const uniqueNames = new Set<string>();
    const suggestions: string[] = [];
    for (const m of nameMatches) {
      if (!uniqueNames.has(m.name)) {
        uniqueNames.add(m.name);
        suggestions.push(m.name);
      }
    }
    return suggestions.slice(0, 5);
  }, [searchQuery, activeStudents]);

  React.useEffect(() => {
    if (selectedStudent) {
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 50);
    }
  }, [selectedStudent]);
  
  const handleDownloadPDF = async () => {
    const dashboardElement = document.getElementById('dashboard-content');
    if (!dashboardElement) return;
    
    try {
      const canvas = await html2canvas(dashboardElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Phieu_Diem_${selectedStudent?.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Đã có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
    }
  };


  const searchResults = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    if (!lowerQuery) return { type: 'empty', data: [] };

    const pickLatest = (rows: StudentData[]) => {
      // Group by email/name and pick the latest attempt
      const latestMap = new Map<string, StudentData>();
      for (const m of rows) {
        const key = m.email || m.name;
        const ex = latestMap.get(key);
        if (!ex || m.stt > ex.stt) latestMap.set(key, m);
      }
      return { type: 'success', data: Array.from(latestMap.values()).slice(0, 5) };
    };

    const matches: StudentData[] = [];
    for (const s of activeStudents) {
      const byName = s.name.toLowerCase().includes(lowerQuery)
        || (!!s.email && s.email.toLowerCase().includes(lowerQuery));
      if (byName) {
        matches.push(s);
      }
    }

    if (matches.length === 0) {
      return { type: 'not_found', data: [] };
    }

    return pickLatest(matches);
  }, [activeStudents, searchQuery]);

  const classProgressData = useMemo(() => {
    const am = new Map<number, { vT: number, vD: number, c: number }>();
    const g = new Map<string, StudentData[]>();
    for (const s of activeStudents) { 
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
      name: `Lần ${n}`, 'TB Chung Toán': d.c ? +(d.vT/d.c).toFixed(2) : 0, 'TB Chung TDKH': d.c ? +(d.vD/d.c).toFixed(2) : 0,
    }));
  }, [activeStudents, progressMetric]);

  const studentHistory = useMemo(() => {
    if (!selectedStudent) return [];
    const key = selectedStudent.email || selectedStudent.name;
    return activeStudents.filter(s => (s.email || s.name) === key).sort((a, b) => a.stt - b.stt);
  }, [selectedStudent, activeStudents]);

  const progressChartData = useMemo(() => {
    return studentHistory.map((s, i) => {
      const n = i + 1;
      const cd = classProgressData.find(c => c.name === `Lần ${n}`);
      const mk = progressMetric === 'tp' ? 'thuongPhat' : progressMetric;
      return {
        name: `Lần ${n}`,
        Toán: s[mk].toan || 0,
        TDKH: s[mk].tdkh || 0,
        'TB Chung Toán': cd ? cd['TB Chung Toán'] : 0,
        'TB Chung TDKH': cd ? cd['TB Chung TDKH'] : 0,
      };
    });
  }, [studentHistory, progressMetric, classProgressData]);

  const chartData = useMemo(() => {
    return studentHistory.map((s, i) => {
      const data: any = { name: `Lần ${i + 1}` };
      if (visibleParts?.tv !== false) data['Tiếng Việt'] = (s.tho.tv || 0) + (s.irt.tv || 0) + (s.thuongPhat.tv || 0);
      if (visibleParts?.ta !== false) data['Tiếng Anh'] = (s.tho.ta || 0) + (s.irt.ta || 0) + (s.thuongPhat.ta || 0);
      if (visibleParts?.toan !== false) data['Toán'] = (s.tho.toan || 0) + (s.irt.toan || 0) + (s.thuongPhat.toan || 0);
      if (visibleParts?.tdkh !== false) data['TDKH'] = (s.tho.tdkh || 0) + (s.irt.tdkh || 0) + (s.thuongPhat.tdkh || 0);
      return data;
    });
  }, [studentHistory, visibleParts]);
  const rankData = useMemo(() => {
    const groups = new Map<string, typeof activeStudents[0] & { totalTho: number, totalIrt: number, totalTp: number }>();
    for (const a of activeStudents) {
      const key = a.email || a.name;
      const ex = groups.get(key);
      const thoScore = (visibleParts?.tv ? (a.tho.tv || 0) : 0) + (visibleParts?.ta ? (a.tho.ta || 0) : 0) + (visibleParts?.toan ? (a.tho.toan || 0) : 0) + (visibleParts?.tdkh ? (a.tho.tdkh || 0) : 0);
      const irtScore = (visibleParts?.tv ? (a.irt.tv || 0) : 0) + (visibleParts?.ta ? (a.irt.ta || 0) : 0) + (visibleParts?.toan ? (a.irt.toan || 0) : 0) + (visibleParts?.tdkh ? (a.irt.tdkh || 0) : 0);
      const tpScore = (visibleParts?.tv ? (a.thuongPhat.tv || 0) : 0) + (visibleParts?.ta ? (a.thuongPhat.ta || 0) : 0) + (visibleParts?.toan ? (a.thuongPhat.toan || 0) : 0) + (visibleParts?.tdkh ? (a.thuongPhat.tdkh || 0) : 0);

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
  }, [activeStudents]);

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
      const key = `${examType}::${selectedStudent.email || selectedStudent.name}`;
      if (!celebratedRef.current.has(key)) {
        setShowCelebration(true);
        celebratedRef.current.add(key);
      } else {
        setShowCelebration(false);
      }
    } else {
      setShowCelebration(false);
    }
  }, [studentRankInfo, selectedStudent, examType]);

  const radarDataCompare = useMemo(() => {
    if (!selectedStudent) return [];
    const getAvg = (subj: 'tv'|'ta'|'toan'|'tdkh') => {
      let s = 0, c = 0;
      activeStudents.forEach(x => {
        const total = (x.tho[subj] || 0) + (x.irt[subj] || 0) + (x.thuongPhat[subj] || 0);
        if (total > 0) { s += total; c++; }
      });
      return c ? +(s / c).toFixed(2) : 0;
    };

    const s = selectedStudent;
    const res: any[] = [];
    if (visibleParts?.tv !== false) {
      res.push({ subject: 'Tiếng Việt', 'Điểm Của Bạn': (s.tho.tv||0)+(s.irt.tv||0)+(s.thuongPhat.tv||0), 'Trung Bình': getAvg('tv') });
    }
    if (visibleParts?.ta !== false) {
      res.push({ subject: 'Tiếng Anh', 'Điểm Của Bạn': (s.tho.ta||0)+(s.irt.ta||0)+(s.thuongPhat.ta||0), 'Trung Bình': getAvg('ta') });
    }
    if (visibleParts?.toan !== false) {
      res.push({ subject: 'Toán', 'Điểm Của Bạn': (s.tho.toan||0)+(s.irt.toan||0)+(s.thuongPhat.toan||0), 'Trung Bình': getAvg('toan') });
    }
    if (visibleParts?.tdkh !== false) {
      res.push({ subject: 'Khoa Học', 'Điểm Của Bạn': (s.tho.tdkh||0)+(s.irt.tdkh||0)+(s.thuongPhat.tdkh||0), 'Trung Bình': getAvg('tdkh') });
    }
    return res;
  }, [selectedStudent, activeStudents, visibleParts]);

  const radarDataParts = useMemo(() => {
    if (!selectedStudent) return [];
    const s = selectedStudent;
    const res: any[] = [];
    if (visibleParts?.tv !== false) {
      res.push({ subject: 'Tiếng Việt', 'Điểm Thô': s.tho.tv||0, 'Điểm IRT': s.irt.tv||0, 'Thưởng Phạt': s.thuongPhat.tv||0 });
    }
    if (visibleParts?.ta !== false) {
      res.push({ subject: 'Tiếng Anh', 'Điểm Thô': s.tho.ta||0, 'Điểm IRT': s.irt.ta||0, 'Thưởng Phạt': s.thuongPhat.ta||0 });
    }
    if (visibleParts?.toan !== false) {
      res.push({ subject: 'Toán', 'Điểm Thô': s.tho.toan||0, 'Điểm IRT': s.irt.toan||0, 'Thưởng Phạt': s.thuongPhat.toan||0 });
    }
    if (visibleParts?.tdkh !== false) {
      res.push({ subject: 'Khoa Học', 'Điểm Thô': s.tho.tdkh||0, 'Điểm IRT': s.irt.tdkh||0, 'Thưởng Phạt': s.thuongPhat.tdkh||0 });
    }
    return res;
  }, [selectedStudent, visibleParts]);

  const tooltipStyle = { borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      alert("Vui lòng nhập Họ và tên để tra cứu.");
      return;
    }
    
    if (searchResults.type === 'success' && searchResults.data.length > 0) {
      setSelectedStudent(searchResults.data[0]);
      setSearchQuery('');
    } else {
      alert("Không tìm thấy thí sinh nào phù hợp.");
    }
  };

  if (!selectedStudent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] fade-in relative w-full">
        
        <div className="relative z-10 w-full flex flex-col items-center px-4">
          

          {/* TITLE & DESCRIPTION */}
          <div className="text-center mb-6 flex flex-col items-center">
            <div className="mb-4 fade-in transform transition-all hover:scale-105 duration-500">
              <img src="/logo.png" alt="Logo" className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_10px_25px_rgba(244,63,94,0.35)] rounded-full ring-4 ring-white/90 dark:ring-purple-400/50 shadow-2xl bg-white/90" />
            </div>
            <div className="relative inline-block fade-in">
              <h1 
                className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight px-4 z-10 relative premium-title pb-2"
              >
                {examName}
              </h1>
            </div>
          </div>

          <div className="mb-10">
            <ExamTypeTabs active={examType} onChange={handleExamTypeChange} counts={examCounts} />
          </div>
          
          {/* FORM */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-2xl px-2 flex flex-col items-center gap-6">
            <div className="w-full rounded-[32px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 flex flex-col gap-6 fade-in transform transition-all duration-300 border border-white/60 dark:border-purple-500/20 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.3)] hover:shadow-[0_25px_60px_-10px_rgba(168,85,247,0.3)]">
              <div className="flex flex-col gap-2 w-full">
              
              <div className="flex-1 flex flex-col gap-3 relative w-full">
                <label htmlFor="lookup-name" className="pl-2 text-xs sm:text-sm font-black uppercase tracking-widest text-indigo-950 dark:text-purple-200">Tra cứu điểm thi</label>
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors duration-300 pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Nhập họ và tên thí sinh..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-16 pr-6 py-5 rounded-2xl border-2 border-slate-200/90 dark:border-purple-500/30 focus:border-purple-600 dark:focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 font-bold text-lg transition-all bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 outline-none shadow-inner"
                  />
                </div>
                
                {/* Suggestions Dropdown */}
                {searchQuery.trim() && searchResults.type === 'success' && searchResults.data.length > 0 && (
                  <div className="absolute top-[100%] mt-3 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-100 dark:border-purple-500/30 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4 duration-200">
                    {searchResults.data.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all border-b border-slate-100 dark:border-slate-700/60 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 group/item"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-300 group-hover/item:scale-110 group-hover/item:bg-purple-600 group-hover/item:text-white transition-all duration-300 shrink-0">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors truncate">{student.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BUTTON */}
            <button 
              type="submit"
              disabled={!searchQuery.trim()}
              className="w-full sm:w-auto sm:mx-auto mt-2 px-12 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-black rounded-2xl transition-all shadow-[0_10px_25px_-5px_rgba(168,85,247,0.5)] hover:shadow-[0_15px_30px_-5px_rgba(244,63,94,0.6)] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-base sm:text-lg tracking-widest flex items-center gap-3 justify-center group"
            >
              <Search className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform duration-300" />
              XEM KẾT QUẢ
            </button>
            </div>
          </form>



        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 pb-8 fade-in max-w-6xl mx-auto w-full min-w-0">
      {viewQuestionKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setViewQuestionKey(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col fade-in scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{viewQuestionKey}</h3>
              <button onClick={() => setViewQuestionKey(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 dark:text-slate-400 dark:text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap text-base">
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
      <div className="mb-2">
        <ExamTypeTabs active={examType} onChange={handleExamTypeChange} counts={examCounts} />
      </div>
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <button 
          onClick={() => { setSelectedStudent(null); setStudentTab('overview'); }}
          className="flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xs hover:shadow-sm font-bold transition-all px-4 sm:px-5 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-sm group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Quay Lại Tra Cứu</span>
        </button>

        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-white bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 dark:hover:bg-indigo-600 font-bold transition-all px-4 sm:px-5 py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-sm shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Phiếu Điểm</span>
        </button>
      </div>

      {/* Main Student Profile & Dashboard Card */}
      <div id="dashboard-content" className="flex flex-col gap-4 sm:gap-5 w-full min-w-0">
        
        {/* Profile Card & Scoreboard */}
        <section className="card p-4 sm:p-6 md:p-7 relative overflow-hidden flex flex-col gap-4 w-full min-w-0">
          
          {/* Top Rank Banner (Compact & Sleek) */}
          {(() => {
            if (!studentRankInfo) return null;
            const isTop1 = studentRankInfo.rankTp === 1 || studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1;
            const isTop2 = !isTop1 && (studentRankInfo.rankTp === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2);
            
            if (isTop1) {
              return (
                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-white shadow-sm font-bold">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">👑</span>
                    <span className="text-xs sm:text-sm font-extrabold tracking-wide">
                      Tuyệt vời! <span className="underline decoration-white/60">{selectedStudent.name}</span> xuất sắc đạt danh hiệu <span className="bg-white/20 px-2 py-0.5 rounded-md text-white font-black uppercase text-xs">Thủ Khoa</span> kỳ thi này!
                    </span>
                  </div>
                </div>
              );
            }
            if (isTop2) {
              return (
                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-300 via-gray-300 to-slate-400 text-slate-800 shadow-sm font-bold">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🥈</span>
                    <span className="text-xs sm:text-sm font-extrabold tracking-wide">
                      Chúc mừng! <span className="underline decoration-slate-800/40">{selectedStudent.name}</span> xuất sắc đạt danh hiệu <span className="bg-slate-900/10 px-2 py-0.5 rounded-md text-slate-900 font-black uppercase text-xs">Á Khoa</span> kỳ thi này!
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Profile Details Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl overflow-hidden shrink-0 shadow-md border-2 border-indigo-200 dark:border-purple-500/40 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                {studentRankInfo && (studentRankInfo.rankTp === 1 || studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1) ? (
                  <span className="text-3xl">👑</span>
                ) : studentRankInfo && (studentRankInfo.rankTp === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2) ? (
                  <span className="text-3xl">🥈</span>
                ) : (
                  <img 
                    src={`https://robohash.org/${encodeURIComponent(selectedStudent.name)}?set=set4&bgset=bg1`}
                    alt="Avatar" 
                    className="w-full h-full object-cover scale-110"
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedStudent.name}
                  </h2>
                  {sbdMap?.[selectedStudent.name] && (
                    <span className="px-2 py-0.5 text-xs font-black rounded-lg bg-indigo-100 dark:bg-purple-900/50 text-indigo-700 dark:text-purple-300 border border-indigo-200 dark:border-purple-700">
                      SBD: {sbdMap[selectedStudent.name]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedStudent.email ? maskEmail(selectedStudent.email) : `Thí sinh STT: ${selectedStudent.stt}`}
                  {studentHistory.length > 1 && (
                    <span className="ml-2 text-indigo-600 dark:text-purple-400 font-bold">
                      · {studentHistory.length} lần thi
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                {EXAM_TYPE_LABEL[examType] || 'Kỳ thi'}
              </span>
            </div>
          </div>

          {/* Compact Scoreboard Bento Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-1">
            {/* Điểm Thô */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Điểm Thô</span>
                {studentRankInfo?.rankTho && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-indigo-600 text-white shadow-xs">
                    Hạng #{studentRankInfo.rankTho}
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {((visibleParts?.tv !== false ? selectedStudent.tho.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.tho.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.tho.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.tho.tdkh || 0 : 0)).toFixed(2)}
              </div>
              <div className="mt-2 pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Toán: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.toan?.toFixed(1) ?? '-'}</strong></span>
                <span>KHTN: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.tdkh?.toFixed(1) ?? '-'}</strong></span>
              </div>
            </div>

            {/* Điểm IRT */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Điểm IRT</span>
                {studentRankInfo?.rankIrt && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-sky-600 text-white shadow-xs">
                    Hạng #{studentRankInfo.rankIrt}
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {((visibleParts?.tv !== false ? selectedStudent.irt.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.irt.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.irt.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.irt.tdkh || 0 : 0)).toFixed(2)}
              </div>
              <div className="mt-2 pt-2 border-t border-sky-100/80 dark:border-sky-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Toán: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.irt.toan?.toFixed(1) ?? '-'}</strong></span>
                <span>KHTN: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.irt.tdkh?.toFixed(1) ?? '-'}</strong></span>
              </div>
            </div>

            {/* Thưởng Phạt */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Thưởng Phạt</span>
                {studentRankInfo?.rankTp && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-amber-600 text-white shadow-xs">
                    Hạng #{studentRankInfo.rankTp}
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {((visibleParts?.tv !== false ? selectedStudent.thuongPhat.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.thuongPhat.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.thuongPhat.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.thuongPhat.tdkh || 0 : 0)).toFixed(2)}
              </div>
              <div className="mt-2 pt-2 border-t border-amber-100/80 dark:border-amber-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Toán: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.thuongPhat.toan?.toFixed(1) ?? '-'}</strong></span>
                <span>KHTN: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.thuongPhat.tdkh?.toFixed(1) ?? '-'}</strong></span>
              </div>
            </div>

            {/* Tình Trạng Bài Làm */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Tỷ Lệ Đúng</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                  {(() => {
                    const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
                    const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
                    const totalQ = (selectedStudent.responses?.length || 60);
                    const correct = Math.max(0, totalQ - wrong - missing);
                    return `${correct}/${totalQ} đúng`;
                  })()}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {(() => {
                  const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
                  const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
                  const totalQ = (selectedStudent.responses?.length || 60);
                  const correct = Math.max(0, totalQ - wrong - missing);
                  return `${Math.round((correct / totalQ) * 100)}%`;
                })()}
              </div>
              <div className="mt-2 pt-2 border-t border-rose-100/80 dark:border-rose-900/40 flex items-center justify-between text-[11px]">
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  {selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0} câu sai
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0} bỏ trống
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-700/60 mt-2 overflow-x-auto hide-scrollbar gap-1 sm:gap-2">
            <button
              onClick={() => setStudentTab('overview')}
              className={`px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                studentTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChartIcon className="w-4 h-4" />
              <span>Phân Tích Năng Lực</span>
            </button>

            <button
              onClick={() => setStudentTab('review')}
              className={`px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                studentTab === 'review'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-500" />
              <span>Câu Hỏi & Ma Trận Kiến Thức</span>
            </button>

            {studentHistory.length > 1 && (
              <button
                onClick={() => setStudentTab('history')}
                className={`px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                  studentTab === 'history'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-rose-500" />
                <span>Lịch Sử {studentHistory.length} Lần Thi</span>
              </button>
            )}

            <button
              onClick={() => setStudentTab('class')}
              className={`px-4 sm:px-6 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                studentTab === 'class'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PieChartIcon className="w-4 h-4 text-amber-500" />
              <span>Thống Kê Toàn Khóa</span>
            </button>
          </div>
        </section>

        {/* TAB 1: OVERVIEW */}
        {studentTab === 'overview' && (
          <div className="flex flex-col gap-4 sm:gap-5 fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* Radar Chart */}
              <div className="card p-4 sm:p-5 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    <BarChartIcon className="w-4 h-4 text-indigo-500" />
                    Đánh Giá Năng Lực
                  </h3>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    <button
                      onClick={() => setRadarMode('compare')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        radarMode === 'compare'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      So với TB Lớp
                    </button>
                    <button
                      onClick={() => setRadarMode('parts')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                        radarMode === 'parts'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Thành phần điểm
                    </button>
                  </div>
                </div>

                <div className="h-[270px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {radarMode === 'compare' ? (
                      <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarDataCompare}>
                        <defs>
                          <linearGradient id="colorUser" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                          </linearGradient>
                          <linearGradient id="colorAvg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Radar name="Điểm Của Bạn" dataKey="Điểm Của Bạn" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorUser)" fillOpacity={0.6} />
                        <Radar name="Trung Bình" dataKey="Trung Bình" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#colorAvg)" fillOpacity={0.4} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toFixed(2)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      </RadarChart>
                    ) : (
                      <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarDataParts}>
                        <defs>
                          <linearGradient id="colorTho" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/>
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0.7}/>
                          </linearGradient>
                          <linearGradient id="colorIrt" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.7}/>
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.7}/>
                          </linearGradient>
                          <linearGradient id="colorTp" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.7}/>
                            <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.7}/>
                          </linearGradient>
                        </defs>
                        <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Radar name="Điểm Thô" dataKey="Điểm Thô" stroke="#10b981" strokeWidth={2} fill="url(#colorTho)" fillOpacity={0.5} />
                        <Radar name="Điểm IRT" dataKey="Điểm IRT" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorIrt)" fillOpacity={0.5} />
                        <Radar name="Thưởng Phạt" dataKey="Thưởng Phạt" stroke="#f59e0b" strokeWidth={2} fill="url(#colorTp)" fillOpacity={0.5} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toFixed(2)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      </RadarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart: Điểm số từng môn */}
              <div className="card p-4 sm:p-5 flex flex-col">
                <div className="flex items-center justify-between mb-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    <span className="icon-box bg-indigo-50 text-indigo-600"><BarChartIcon className="w-4 h-4" /></span>
                    Điểm Số Theo Từng Môn
                  </h3>
                </div>
                <div className="h-[270px] sm:h-[300px] w-full -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                      {visibleParts?.tv !== false && <Bar dataKey="Tiếng Việt" fill="#06b6d4" radius={[6,6,0,0]} maxBarSize={45} />}
                      {visibleParts?.ta !== false && <Bar dataKey="Tiếng Anh" fill="#ec4899" radius={[6,6,0,0]} maxBarSize={45} />}
                      {visibleParts?.toan !== false && <Bar dataKey="Toán" fill="#6366f1" radius={[6,6,0,0]} maxBarSize={45} />}
                      {visibleParts?.tdkh !== false && <Bar dataKey="TDKH" fill="#0ea5e9" radius={[6,6,0,0]} maxBarSize={45} />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* If attempts > 1, show progress chart */}
            {studentHistory.length > 1 && (
              <div className="card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    <span className="icon-box bg-rose-50 text-rose-500"><TrendingUp className="w-4 h-4" /></span>
                    Tiến Bộ Qua Các Lần Thi
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                      <button 
                        onClick={() => setProgressSubject('Toán')} 
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${progressSubject === 'Toán' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      >
                        Môn Toán
                      </button>
                      <button 
                        onClick={() => setProgressSubject('TDKH')} 
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${progressSubject === 'TDKH' ? 'bg-white dark:bg-slate-700 text-sky-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      >
                        Môn TDKH
                      </button>
                    </div>
                    <select className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={progressMetric} onChange={(e) => setProgressMetric(e.target.value as any)}>
                      <option value="tho">Điểm Thô</option>
                      <option value="irt">Điểm IRT</option>
                      <option value="tp">Thưởng Phạt</option>
                    </select>
                  </div>
                </div>
                <div className="h-[230px] sm:h-[260px] w-full -ml-3 sm:-ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                      <Area 
                        type="monotone" 
                        name={`Điểm ${progressSubject} (Cá nhân)`} 
                        dataKey={progressSubject} 
                        stroke={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#colorScore)" 
                        dot={{ r: 3.5, fill: '#fff', strokeWidth: 2, stroke: progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9' }} 
                        activeDot={{ r: 5 }} 
                      />
                      <Line 
                        type="monotone" 
                        name={`TB Lớp ${progressSubject}`} 
                        dataKey={`TB Chung ${progressSubject}`} 
                        stroke="#94a3b8" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5} 
                        dot={false} 
                        activeDot={false} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REVIEW QUESTIONS & KNOWLEDGE MATRIX */}
        {studentTab === 'review' && (
          <div className="flex flex-col gap-4 sm:gap-5 fade-in">
            {/* Vùng kiến thức */}
            {(() => {
              const activeTopicMap = topicMap || defaultTopicMap;
              const wrongSet = new Set(selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []);
              const missingSet = new Set(selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []);

              const categoryGroups: { category: string; topics: string[]; color: string; bgColor: string; barColor: string }[] = [
                { category: 'Đại số', topics: ['Hệ bất phương trình bậc nhất 2 ẩn', 'Hàm số bậc 2', 'Lượng giác', 'Dãy số', 'Giới hạn & Hàm số liên tục', 'Số mũ & Logarit', 'Đạo hàm', 'Xác suất & Tổ hợp'], color: 'text-indigo-700 dark:text-indigo-300', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30', barColor: 'bg-indigo-500' },
                { category: 'Hình học', topics: ['Hệ thức lượng trong tam giác & Vecto', 'Toạ độ Oxy', 'Hình học không gian'], color: 'text-violet-700 dark:text-violet-300', bgColor: 'bg-violet-50 dark:bg-violet-900/30', barColor: 'bg-violet-500' },
                { category: 'Logic', topics: ['Logic sắp xếp', 'Logic phân nhóm'], color: 'text-cyan-700 dark:text-cyan-300', bgColor: 'bg-cyan-50 dark:bg-cyan-900/30', barColor: 'bg-cyan-500' },
                { category: 'PTSL', topics: ['Dữ liệu bảng', 'Dữ liệu biểu đồ cột', 'Dữ liệu biểu đồ tròn'], color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/30', barColor: 'bg-amber-500' },
                { category: 'SLKH', topics: ['Đọc hiểu KHTN', 'Đọc hiểu KHXH'], color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30', barColor: 'bg-emerald-500' },
              ];

              const topicData = Object.entries(activeTopicMap).map(([topic, qNums]) => {
                const total = qNums.length;
                const wrong = qNums.filter(q => wrongSet.has(q)).length;
                const missing = qNums.filter(q => missingSet.has(q)).length;
                const correct = total - wrong - missing;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                return { topic, qNums, total, correct, wrong, missing, pct };
              });

              const catData = categoryGroups.map(g => {
                const topics = g.topics
                  .map(t => topicData.find(td => td.topic === t))
                  .filter(Boolean) as typeof topicData;
                const total = topics.reduce((s, t) => s + t.total, 0);
                const correct = topics.reduce((s, t) => s + t.correct, 0);
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                return { ...g, topics, total, correct, pct };
              }).filter(c => c.total > 0);

              const overallTotal = topicData.reduce((s, t) => s + t.total, 0);
              const overallCorrect = topicData.reduce((s, t) => s + t.correct, 0);
              const overallPct = overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0;

              const getPctColor = (pct: number) => {
                if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
                if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
                return 'text-rose-600 dark:text-rose-400';
              };

              return (
                <div className="card overflow-hidden w-full min-w-0">
                  <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                        <Target className="w-5 h-5 text-emerald-500" />
                        Số Câu Đúng Theo Vùng Kiến Thức
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Tổng cộng: <span className={`font-bold ${getPctColor(overallPct)}`}>{overallCorrect}/{overallTotal} câu đúng ({overallPct}%)</span>
                      </p>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    {catData.map(cat => (
                      <div key={cat.category} className="p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-black text-xs sm:text-sm uppercase tracking-wide ${cat.color}`}>{cat.category}</h4>
                          <div className="flex items-center gap-2.5">
                            <span className={`text-xs font-bold ${getPctColor(cat.pct)}`}>{cat.correct}/{cat.total} đúng</span>
                            <span className={`text-xs sm:text-sm font-black tabular-nums ${getPctColor(cat.pct)}`}>{cat.pct}%</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-700/80 rounded-full mb-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${cat.barColor}`}
                            style={{ width: `${cat.pct}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cat.topics.map(t => (
                            <div key={t.topic} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 text-xs">
                              <span className="flex-1 truncate text-slate-700 dark:text-slate-200 font-medium">{t.topic}</span>
                              <span className={`font-bold tabular-nums ${getPctColor(t.pct)}`}>{t.correct}/{t.total} ({t.pct}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Chi tiết câu sai và bỏ trống */}
            <div className="card overflow-hidden w-full min-w-0">
              <button
                onClick={() => setShowWrongDetail(!showWrongDetail)}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                      Chi Tiết Các Câu Sai & Bỏ Trống
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {(() => {
                        const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
                        const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
                        if (wrong + missing === 0) return 'Không có lỗi sai nào';
                        const parts = [];
                        if (wrong > 0) parts.push(`${wrong} câu sai`);
                        if (missing > 0) parts.push(`${missing} câu bỏ trống`);
                        return parts.join(' · ') + ' — nhấp để ' + (showWrongDetail ? 'thu gọn' : 'mở rộng');
                      })()}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${showWrongDetail ? 'rotate-180' : ''}`} />
              </button>
              
              {showWrongDetail && (
                <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                  <table className="w-full text-sm text-left border-collapse min-w-full sm:min-w-[650px]">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">Câu Hỏi / Nội dung</th>
                        <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 w-24">Trạng thái</th>
                        <th className="hidden sm:table-cell px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-20">TS đúng</th>
                        <th className="hidden sm:table-cell px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-20 text-rose-500">TS sai</th>
                        <th className="hidden sm:table-cell px-3 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-20 text-amber-600">Phạt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent.responses?.filter(r => r.status === 'wrong' || r.status === 'missing').sort((a,b) => a.question_num - b.question_num).map((r, i) => {
                        const qKey = `Câu ${r.question_num}`;
                        const qData = activeQuestions.find(q => q.id === qKey);
                        return (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-slate-900/50 transition-colors cursor-pointer" onClick={() => setViewQuestionKey(qKey)}>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 dark:text-slate-100 mb-0.5 text-xs sm:text-sm">{qKey} <span className="text-[11px] font-normal text-slate-500 ml-1.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{qData?.subject || ''}</span></div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs line-clamp-1">{currentTexts[qKey] || "Chưa có dữ liệu nội dung câu hỏi."}</div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${r.status === 'wrong' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'}`}>
                                {r.status === 'wrong' ? 'Làm Sai' : 'Bỏ Trống'}
                              </span>
                            </td>
                            <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-emerald-600 font-bold text-xs">{qData?.correct ?? '-'}</td>
                            <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-rose-500 font-bold text-xs">{qData?.incorrect ?? '-'}</td>
                            <td className="hidden sm:table-cell px-3 py-3 text-right tabular-nums text-amber-600 font-bold text-xs">
                              {qData?.penaltyScore !== null && qData?.penaltyScore !== undefined ? qData.penaltyScore.toFixed(3) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedStudent.responses || selectedStudent.responses.filter(r => r.status === 'wrong' || r.status === 'missing').length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic text-xs">Không có lỗi sai nào.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ma Trận Kiến Thức */}
            <div className="card overflow-hidden w-full min-w-0">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Ma Trận Kiến Thức Cần Ôn Tập
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ô tô <span className="text-rose-500 font-bold">Đỏ</span>: Làm sai. Ô tô <span className="text-amber-500 font-bold">Vàng</span>: Bỏ trống.
                </p>
              </div>
              <div className="p-4 overflow-x-auto bg-white dark:bg-slate-900/60">
                <div className="min-w-[650px]">
                  <Suspense fallback={<div className="h-40 flex items-center justify-center text-slate-400 text-xs">Đang tải ma trận kiến thức...</div>}>
                    <KnowledgeMatrix 
                      wrongQuestions={selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []} 
                      missingQuestions={selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []}
                      topicMap={topicMap || undefined}
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HISTORY (Multi-attempt comparison) */}
        {studentTab === 'history' && studentHistory.length > 1 && (
          <div className="card p-4 sm:p-6 fade-in overflow-hidden">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="icon-box bg-emerald-50 text-emerald-600"><FileSpreadsheet className="w-[18px] h-[18px]" /></span>
              Bảng So Sánh Chi Tiết Các Lần Thi
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse border border-slate-200 dark:border-slate-700">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                  <tr>
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" rowSpan={2}>Lần Thi</th>
                    {visibleParts?.tv !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Tiếng Việt</th>}
                    {visibleParts?.ta !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Tiếng Anh</th>}
                    {visibleParts?.toan !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Toán</th>}
                    {visibleParts?.tdkh !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>TDKH</th>}
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center bg-indigo-50/50 dark:bg-indigo-950/30" rowSpan={2}>Tổng<br/>Thưởng Phạt</th>
                  </tr>
                  <tr>
                    {visibleParts?.tv !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Thô</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px] text-amber-700">T.Phạt</th></>}
                    {visibleParts?.ta !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Thô</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px] text-amber-700">T.Phạt</th></>}
                    {visibleParts?.toan !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Thô</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px] text-amber-700">T.Phạt</th></>}
                    {visibleParts?.tdkh !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Thô</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px] text-amber-700">T.Phạt</th></>}
                  </tr>
                </thead>
                <tbody>
                  {studentHistory.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">Lần {i + 1}</td>
                      {visibleParts?.tv !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.tv?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.tv?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.tv?.toFixed(2) ?? '-'}</td></>}
                      {visibleParts?.ta !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.ta?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.ta?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.ta?.toFixed(2) ?? '-'}</td></>}
                      {visibleParts?.toan !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.toan?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.toan?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.toan?.toFixed(2) ?? '-'}</td></>}
                      {visibleParts?.tdkh !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.tdkh?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.tdkh?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.tdkh?.toFixed(2) ?? '-'}</td></>}
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20">
                        {((visibleParts?.tv !== false ? (s.thuongPhat.tv || 0) : 0) + (visibleParts?.ta !== false ? (s.thuongPhat.ta || 0) : 0) + (visibleParts?.toan !== false ? (s.thuongPhat.toan || 0) : 0) + (visibleParts?.tdkh !== false ? (s.thuongPhat.tdkh || 0) : 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CLASS ANALYTICS */}
        {studentTab === 'class' && (
          <div className="flex flex-col gap-6 fade-in">
            <Suspense fallback={<LazyFallback />}>
              <AbilityDistribution students={activeStudents} metric={classMetric} onMetricChange={setClassMetric} />
            </Suspense>
            <Suspense fallback={<LazyFallback />}>
              <ClassAnalytics
                students={activeStudents}
                questions={activeQuestions}
                metric={classMetric}
                onSelectStudent={s => setSelectedStudent(s)}
              />
            </Suspense>
          </div>
        )}

      </div>

      {/* Info Section */}
      {(answerLink || nextExamDate) && (
        <div className="mt-8 sm:mt-12 bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          {nextExamDate && (
            <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Dự kiến đợt thi tiếp theo</p>
                <p className="font-bold text-slate-800 dark:text-slate-100 sm:text-lg">{nextExamDate}</p>
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

      {/* Feedback Section */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-indigo-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Góp ý & Giải đáp</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">Nếu có bất kỳ thắc mắc hoặc góp ý nào về kết quả thi, hãy liên hệ với chúng tôi.</p>
          </div>
        </div>
        <a 
          href="https://discordapp.com/users/734403880208564235" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto text-center"
        >
          Liên hệ Discord
        </a>
      </div>
    </div>
  );
}
