import React, { Suspense, lazy, useMemo, useState } from 'react';
import { MetricKey, QuestionData, StudentData } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key, Target, PieChart as PieChartIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
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
  const celebratedRef = React.useRef<Set<string>>(new Set());

  const autoCompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const lowerName = searchQuery.toLowerCase();
    const nameMatches = students.filter(s => s.name.toLowerCase().includes(lowerName) || (s.email && s.email.toLowerCase().includes(lowerName)));
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
  }, [searchQuery, students]);

  
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
    for (const s of students) {
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
  }, [students, searchQuery]);

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
      name: `Lần ${n}`, 'TB Chung Toán': d.c ? +(d.vT/d.c).toFixed(2) : 0, 'TB Chung TDKH': d.c ? +(d.vD/d.c).toFixed(2) : 0,
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
        'TB Chung Toán': cd ? cd['TB Chung Toán'] : 0,
        'TB Chung TDKH': cd ? cd['TB Chung TDKH'] : 0,
      };
    });
  }, [studentHistory, progressMetric, classProgressData]);

  const rankData = useMemo(() => {
    const groups = new Map<string, typeof students[0] & { totalTho: number, totalIrt: number, totalTp: number }>();
    for (const a of students) {
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

  const radarDataCompare = useMemo(() => {
    if (!selectedStudent) return [];
    const getAvg = (subj: 'tv'|'ta'|'toan'|'tdkh') => {
      let s = 0, c = 0;
      students.forEach(x => {
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
  }, [selectedStudent, students, visibleParts]);

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
        
        <div className="relative z-10 w-full flex flex-col lg:flex-row items-center justify-center gap-12 px-4 max-w-7xl mx-auto">
          
          {/* LEFT: Text & Form */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-2xl">
            <div className="mb-6 fade-in transform transition-all hover:scale-105 duration-500">
              <img src="/logo.png" alt="Logo" className="w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-2xl rounded-full ring-4 ring-white/80 dark:ring-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)]" />
            </div>
            <div className="relative inline-block mt-1 fade-in">
              <h1 
                className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight z-10 relative bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 dark:from-rose-400 dark:via-red-400 dark:to-amber-400 drop-shadow-sm"
              >
                {examName}
              </h1>
              <div className="absolute -bottom-2 left-0 w-1/2 h-1.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-full opacity-70 blur-[1px]"></div>
            </div>
            
            <div className="mt-8 mb-8 text-center lg:text-left">
              <p className="inline-block px-6 py-2.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-lg text-sm sm:text-base text-slate-700 dark:text-slate-200 font-bold border border-white/50 dark:border-slate-700/50">
                Nhập họ tên bên dưới để tra cứu
              </p>
            </div>
          
          {/* FORM */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-2xl px-2 flex flex-col items-center gap-6">
            <div className="w-full rounded-[32px] border border-white/80 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04),0_30px_60px_-15px_rgba(99,102,241,0.15)] p-6 sm:p-8 flex flex-col gap-6 fade-in transform transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04),0_30px_60px_-15px_rgba(99,102,241,0.25)]">
              <div className="flex flex-col gap-2 w-full">
              
              {/* Input 1 */}
              <div className="flex-1 flex flex-col gap-2 relative w-full">
                <label htmlFor="lookup-name" className="pl-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Họ và tên</label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300 pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Nhập thông tin để bắt đầu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-14 pr-5 py-4 sm:py-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-semibold text-lg transition-all bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-600 outline-none shadow-inner"
                  />
                </div>
                
                {/* Suggestions Dropdown */}
                {searchQuery.trim() && searchResults.type === 'success' && searchResults.data.length > 0 && (
                  <div className="absolute top-[100%] mt-3 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4 duration-200">
                    {searchResults.data.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-5 sm:px-6 py-3 sm:py-4 hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-all border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 group/item"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 group-hover/item:scale-110 group-hover/item:bg-indigo-500 group-hover/item:text-white transition-all duration-300 shrink-0">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors truncate">{student.name}</span>
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
              className="w-full sm:w-auto sm:mx-auto mt-2 px-12 py-4 sm:py-5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 text-white font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-base sm:text-lg tracking-widest flex items-center gap-3 justify-center group"
            >
              <Search className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform duration-300" />
              TRA CỨU KẾT QUẢ
            </button>
            </div>
          </form>
          </div>

          {/* RIGHT: Illustration */}
          <div className="flex-1 hidden lg:flex justify-center items-center fade-in">
            <img src="/search_hero.jpg" alt="Illustration" className="w-[500px] xl:w-[600px] object-cover rounded-3xl drop-shadow-2xl hover:scale-105 transition-transform duration-700" />
          </div>        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 pb-8 fade-in max-w-6xl mx-auto">
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
      <button 
        onClick={() => setSelectedStudent(null)}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-xl shadow-sm hover:shadow-md font-bold transition-all w-fit px-5 py-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 mb-6 relative z-10 group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Quay Lại Tìm Kiếm
      </button>

      {/* Single Student Profile */}
      <section className="card relative overflow-hidden flex flex-col">
        
        {/* Banner Image */}
        <div className="w-full h-40 sm:h-56 md:h-64 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
          <img src="/dashboard_banner.jpg" alt="Dashboard Banner" className="w-full h-full object-cover" />
          <h2 className="absolute bottom-4 left-6 sm:left-10 z-20 text-white font-black text-2xl sm:text-3xl drop-shadow-md">
            Hồ Sơ Năng Lực Của Bạn
          </h2>
        </div>

        <div className="p-5 sm:p-8 md:p-10 flex flex-col gap-4">
        {(() => {
          if (!studentRankInfo) return null;
          const isTop1 = studentRankInfo.rankTp === 1 || studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1;
          const isTop2 = !isTop1 && (studentRankInfo.rankTp === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2);
          
          if (isTop1) {
            return (
              <div className="relative overflow-hidden bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 border-2 border-yellow-300 text-white font-bold px-6 py-5 rounded-2xl mb-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transform hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white dark:bg-slate-800 opacity-20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white dark:bg-slate-800/20 backdrop-blur-md rounded-full flex items-center justify-center text-3xl shadow-inner shrink-0 border border-white/40">
                    👑
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black drop-shadow-md">Tuyệt vời, {selectedStudent.name}!</h3>
                    <p className="font-semibold text-yellow-50/90 text-sm sm:text-base mt-1">Xuất sắc đạt danh hiệu <span className="uppercase font-black text-white bg-black/10 px-2 py-0.5 rounded ml-1">Thủ Khoa</span> trong đợt thi này!</p>
                  </div>
                </div>
              </div>
            );
          }
          if (isTop2) {
            return (
              <div className="relative overflow-hidden bg-gradient-to-r from-slate-300 via-gray-300 to-slate-400 border-2 border-slate-300 text-slate-800 dark:text-slate-100 font-bold px-6 py-5 rounded-2xl mb-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transform hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white dark:bg-slate-800 opacity-40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white dark:bg-slate-800/40 backdrop-blur-md rounded-full flex items-center justify-center text-3xl shadow-inner shrink-0 border border-white/50">
                    👑
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black drop-shadow-sm">Chúc mừng, {selectedStudent.name}!</h3>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm sm:text-base mt-1">Xuất sắc đạt danh hiệu <span className="uppercase font-black text-slate-900 bg-white dark:bg-slate-800/30 px-2 py-0.5 rounded ml-1">Á Khoa</span> trong đợt thi này!</p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 border-b border-slate-200/60 dark:border-slate-700/50 pb-6 mb-6 mt-4 sm:mt-0">
          {(() => {
            const isTop1 = studentRankInfo && (studentRankInfo.rankTp === 1 || studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1);
            const isTop2 = !isTop1 && studentRankInfo && (studentRankInfo.rankTp === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2);
            
            if (isTop1) {
              return (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 shadow-md border-4 border-yellow-400 bg-yellow-50 text-4xl flex items-center justify-center">
                  👑
                </div>
              );
            }
            if (isTop2) {
              return (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 shadow-md border-4 border-slate-300 bg-slate-50 dark:bg-slate-900/50 text-4xl flex items-center justify-center">
                  👑
                </div>
              );
            }
            return (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 shadow-sm border-2 border-indigo-100 bg-indigo-50/50 flex items-center justify-center">
                <img 
                  src={`https://robohash.org/${encodeURIComponent(selectedStudent.name)}?set=set4&bgset=bg1`}
                  alt="Avatar" 
                  className="w-full h-full object-cover scale-110"
                />
              </div>
            );
          })()}
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">{selectedStudent.name}</h2>
          </div>
          {studentRankInfo && (
            <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-0">
              <div className="bg-indigo-50/80 dark:bg-indigo-900/30 backdrop-blur-sm px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-indigo-200/60 dark:border-indigo-500/30 text-center min-w-[85px] sm:min-w-[110px] flex-1 sm:flex-none shadow-sm">
                <div className="text-[10px] sm:text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1">Hạng Thô</div>
                <div className="text-xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300">#{studentRankInfo.rankTho}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Tổng: {studentRankInfo.totalTho.toFixed(2)}</div>
              </div>
              <div className="bg-sky-50/80 dark:bg-sky-900/30 backdrop-blur-sm px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-sky-200/60 dark:border-sky-500/30 text-center min-w-[85px] sm:min-w-[110px] flex-1 sm:flex-none shadow-sm">
                <div className="text-[10px] sm:text-xs font-bold text-sky-500 dark:text-sky-400 uppercase tracking-wider mb-1">Hạng IRT</div>
                <div className="text-xl sm:text-3xl font-black text-sky-700 dark:text-sky-300">#{studentRankInfo.rankIrt}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Tổng: {studentRankInfo.totalIrt.toFixed(2)}</div>
              </div>
              <div className="bg-amber-50/80 dark:bg-amber-900/30 backdrop-blur-sm px-3 py-2.5 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl border border-amber-200/60 dark:border-amber-500/30 text-center min-w-[85px] sm:min-w-[110px] flex-1 sm:flex-none shadow-sm">
                <div className="text-[10px] sm:text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-1">Hạng T.Phạt</div>
                <div className="text-xl sm:text-3xl font-black text-amber-700 dark:text-amber-300">#{studentRankInfo.rankTp}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Tổng: {studentRankInfo.totalTp.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          <div className="p-4 sm:p-5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-slate-200/60 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all shadow-sm hover:shadow-md group">
            <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 group-hover:text-indigo-500 transition-colors">Tổng Điểm Thô</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400">{((visibleParts?.tv !== false ? selectedStudent.tho.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.tho.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.tho.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.tho.tdkh || 0 : 0)).toFixed(2)}</p>
          </div>
          <div className="p-4 sm:p-5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-slate-200/60 dark:border-slate-700/50 hover:border-sky-300 dark:hover:border-sky-500/50 transition-all shadow-sm hover:shadow-md group">
            <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 group-hover:text-sky-500 transition-colors">Tổng Điểm IRT</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-sky-600 dark:text-sky-400">{((visibleParts?.tv !== false ? selectedStudent.irt.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.irt.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.irt.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.irt.tdkh || 0 : 0)).toFixed(2)}</p>
          </div>
          <div className="p-4 sm:p-5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-slate-200/60 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-500/50 transition-all shadow-sm hover:shadow-md group">
            <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 group-hover:text-amber-500 transition-colors">Tổng Thưởng Phạt</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400">{((visibleParts?.tv !== false ? selectedStudent.thuongPhat.tv || 0 : 0) + (visibleParts?.ta !== false ? selectedStudent.thuongPhat.ta || 0 : 0) + (visibleParts?.toan !== false ? selectedStudent.thuongPhat.toan || 0 : 0) + (visibleParts?.tdkh !== false ? selectedStudent.thuongPhat.tdkh || 0 : 0)).toFixed(2)}</p>
          </div>
          <div className="p-4 sm:p-5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[20px] border border-rose-200/60 dark:border-rose-700/50 hover:border-rose-300 dark:hover:border-rose-500/50 transition-all shadow-sm hover:shadow-md group">
            <p className="text-[10px] sm:text-[11px] md:text-xs text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider mb-2 group-hover:text-rose-600 transition-colors">Câu sai / Bỏ trống</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400">
              {selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0} <span className="text-rose-300 dark:text-rose-600/50 font-normal mx-0.5">/</span> {selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0}
            </p>
          </div>
        </div>
        
        {/* Student Ability Chart */}
        <div className="mt-6 sm:mt-8 bg-slate-50/50 dark:bg-slate-900/30 rounded-[28px] border border-slate-200/60 dark:border-slate-700/50 p-5 sm:p-7 shadow-inner">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2 mb-6">
            <BarChartIcon className="w-5 h-5 text-indigo-500" />
            Đánh Giá Năng Lực Của Bạn So Với Mặt Bằng Chung
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Radar 1: Bạn vs Trung Bình */}
            <div className="flex flex-col items-center w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-[24px] shadow-sm border border-slate-200/60 dark:border-slate-700/50 p-4">
              <h4 className="font-bold text-indigo-600 dark:text-indigo-400 mb-2 mt-2">Tổng Điểm Bạn So Với Trung Bình</h4>
              <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar name="Điểm Của Bạn" dataKey="Điểm Của Bạn" stroke="#6366f1" strokeWidth={3} fill="url(#colorUser)" fillOpacity={0.7} />
                    <Radar name="Trung Bình" dataKey="Trung Bình" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorAvg)" fillOpacity={0.5} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                      formatter={(value: number) => value.toFixed(2)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Radar 2: Chi tiết các phần */}
            <div className="flex flex-col items-center w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-[24px] shadow-sm border border-slate-200/60 dark:border-slate-700/50 p-4">
              <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-2 mt-2">Chi Tiết Năng Lực (Thô, IRT, T.Phạt)</h4>
              <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Radar name="Điểm Thô" dataKey="Điểm Thô" stroke="#10b981" strokeWidth={2} fill="url(#colorTho)" fillOpacity={0.5} />
                    <Radar name="Điểm IRT" dataKey="Điểm IRT" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorIrt)" fillOpacity={0.5} />
                    <Radar name="Thưởng Phạt" dataKey="Thưởng Phạt" stroke="#f59e0b" strokeWidth={2} fill="url(#colorTp)" fillOpacity={0.5} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                      formatter={(value: number) => value.toFixed(2)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 sm:mt-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
          <button
            onClick={() => setShowWrongDetail(!showWrongDetail)}
            className="w-full p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between hover:bg-slate-100 dark:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  Chi tiết các câu sai và bỏ trống
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">
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
            <ChevronDown className={`w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 ${showWrongDetail ? 'rotate-180' : ''}`} />
          </button>
          
          {showWrongDetail && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-full sm:min-w-[700px]">
              <thead className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 uppercase font-semibold">
                <tr>
                  <th className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700">Câu Hỏi / Nội dung</th>
                  <th className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-20 sm:w-24">Trạng thái</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-24">TS đúng</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-24 text-rose-500">TS sai</th>
                  <th className="hidden sm:table-cell px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-right w-24 text-amber-600">Phạt</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudent.responses?.filter(r => r.status === 'wrong' || r.status === 'missing').sort((a,b) => a.question_num - b.question_num).map((r, i) => {
                  const qKey = `Câu ${r.question_num}`;
                  const qData = questions.find(q => q.id === qKey);
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:bg-slate-900/50 transition-colors cursor-pointer" onClick={() => setViewQuestionKey(qKey)}>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">{qKey} <span className="text-xs font-normal text-slate-500 dark:text-slate-400 dark:text-slate-500 ml-2 bg-slate-200/50 px-1.5 py-0.5 rounded">{qData?.subject || ''}</span></div>
                        <div className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs line-clamp-2">{currentTexts[qKey] || "Chưa có dữ liệu nội dung câu hỏi."}</div>
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
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 dark:text-slate-500 italic">Không có lỗi sai nào hoặc chưa có dữ liệu chi tiết.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        <div className="mt-6 sm:mt-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Ma Trận Kiến Thức Cần Ôn Tập
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
              Phần tô <span className="text-rose-500 font-semibold">Đỏ</span>: Thí sinh làm sai. 
              Phần tô <span className="text-amber-500 font-semibold">Vàng</span>: Thí sinh bỏ trống.
            </p>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto bg-white dark:bg-slate-800">
            <div className="min-w-[700px]">
              <Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Đang tải ma trận kiến thức...</div>}>
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
      </section>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 ${studentHistory.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        <section className="card p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
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
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-rose-50 text-rose-500"><TrendingUp className="w-[18px] h-[18px]" /></span>
              Tiến Bộ Cá Nhân
            </h2>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setProgressSubject('Toán')} 
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${progressSubject === 'Toán' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200'}`}
                >
                  Môn Toán
                </button>
                <button 
                  onClick={() => setProgressSubject('TDKH')} 
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${progressSubject === 'TDKH' ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-200'}`}
                >
                  Môn TDKH
                </button>
              </div>
              <select className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                  name={`Trung bình chung ${progressSubject}`} 
                  dataKey={`TB Chung ${progressSubject}`} 
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
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="icon-box bg-emerald-50 text-emerald-600"><FileSpreadsheet className="w-[18px] h-[18px]" /></span>
              Bảng So Sánh Các Lần Thi
            </h2>
          </div>
          <div className="p-4 sm:p-5 overflow-x-auto bg-white dark:bg-slate-800">
            <table className="w-full text-sm text-left border-collapse border border-slate-200 dark:border-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                <tr>
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" rowSpan={2}>Lần Thi</th>
                  {visibleParts?.tv !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Tiếng Việt</th>}
                  {visibleParts?.ta !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Tiếng Anh</th>}
                  {visibleParts?.toan !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>Toán</th>}
                  {visibleParts?.tdkh !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={3}>TDKH</th>}
                  <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center bg-indigo-50/50" rowSpan={2}>Tổng<br/>Thưởng Phạt</th>
                </tr>
                <tr>
                  {visibleParts?.tv !== false && <><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm Thô</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm IRT</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th></>}
                  {visibleParts?.ta !== false && <><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm Thô</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm IRT</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th></>}
                  {visibleParts?.toan !== false && <><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm Thô</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm IRT</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th></>}
                  {visibleParts?.tdkh !== false && <><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm Thô</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs">Điểm IRT</th><th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-xs text-amber-700">Thưởng Phạt</th></>}
                </tr>
              </thead>
              <tbody>
                {studentHistory.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:bg-slate-900/50 transition-colors">
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-200">Lần {i + 1}</td>
                    {visibleParts?.tv !== false && <><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.tho.tv?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.irt.tv?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.tv?.toFixed(2) ?? '-'}</td></>}
                    {visibleParts?.ta !== false && <><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.tho.ta?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.irt.ta?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.ta?.toFixed(2) ?? '-'}</td></>}
                    {visibleParts?.toan !== false && <><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.tho.toan?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.irt.toan?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.toan?.toFixed(2) ?? '-'}</td></>}
                    {visibleParts?.tdkh !== false && <><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.tho.tdkh?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">{s.irt.tdkh?.toFixed(2) ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-medium text-amber-600 bg-amber-50/30">{s.thuongPhat.tdkh?.toFixed(2) ?? '-'}</td></>}
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-bold text-indigo-600 bg-indigo-50/30">
                      {((visibleParts?.tv !== false ? (s.thuongPhat.tv || 0) : 0) + (visibleParts?.ta !== false ? (s.thuongPhat.ta || 0) : 0) + (visibleParts?.toan !== false ? (s.thuongPhat.toan || 0) : 0) + (visibleParts?.tdkh !== false ? (s.thuongPhat.tdkh || 0) : 0)).toFixed(2)}
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
