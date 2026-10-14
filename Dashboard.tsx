import React, { Suspense, lazy, useMemo, useState } from 'react';
import { ExamType, MetricKey, QuestionData, StudentData } from './types';
import { EXAM_TYPES, EXAM_TYPE_LABEL, countByExamType, examTypeOf, filterByExamType } from './analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key, Target, PieChart as PieChartIcon, Check, CheckCircle2, Layers, Filter, LayoutGrid, Table, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
import { CelebrationOverlay } from './CelebrationOverlay';
import questionTexts from './question_texts.json';
import { parseKnowledgeCSV, DEFAULT_KNOWLEDGE_CSV, DomainCategory, defaultTopicMap } from './lib/knowledgeStructure';

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
  knowledgeCsv?: string;
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

export function Dashboard({ questions, students, examName, topicMap, knowledgeCsv, questionTexts: propQuestionTexts, answerLink, nextExamDate, sbdMap, visibleParts }: Props) {
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
  const [knowledgeFilter, setKnowledgeFilter] = useState<'all' | 'strong' | 'medium' | 'weak'>('all');
  const [knowledgeViewMode, setKnowledgeViewMode] = useState<'cards' | 'table'>('cards');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const celebratedRef = React.useRef<Set<string>>(new Set());

  const examCounts = useMemo(() => countByExamType(students), [students]);
  const activeStudents = useMemo(() => filterByExamType(students, examType), [students, examType]);
  const activeQuestions = useMemo(() => filterByExamType(questions, examType), [questions, examType]);

  // Determine max question number in active exam / student data
  const maxExamQuestionNum = useMemo(() => {
    let max = 60;
    if (activeQuestions.length > max) max = activeQuestions.length;
    if (selectedStudent?.responses && selectedStudent.responses.length > 0) {
      const studentMax = Math.max(...selectedStudent.responses.map(r => r.question_num));
      if (studentMax > max) max = studentMax;
    }
    return max;
  }, [activeQuestions, selectedStudent]);

  // Parse knowledge structure based on CSV and active question scale
  const knowledgeStructure = useMemo(() => {
    return parseKnowledgeCSV(knowledgeCsv || DEFAULT_KNOWLEDGE_CSV, maxExamQuestionNum);
  }, [knowledgeCsv, maxExamQuestionNum]);

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
    if (!selectedStudent) return;
    const dashboardElement = document.getElementById('dashboard-content');
    if (!dashboardElement) return;
    
    setIsExportingPDF(true);
    try {
      // Small delay to allow any pending DOM paint
      await new Promise(r => setTimeout(r, 60));

      const canvas = await html2canvas(dashboardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        imageTimeout: 6000,
        onclone: (clonedDoc) => {
          const img = clonedDoc.querySelector('img[alt="Avatar"]') as HTMLImageElement | null;
          if (img) {
            img.crossOrigin = 'anonymous';
          }
        },
        ignoreElements: (element) => {
          return element.classList.contains('no-pdf') || element.getAttribute('data-no-pdf') === 'true';
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (selectedStudent.name || 'Thi_Sinh').replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      pdf.save(`Phieu_Diem_${safeName}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Đã có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
    } finally {
      setIsExportingPDF(false);
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
            <div className="mb-4 fade-in transform transition-all hover:scale-105 duration-300">
              <div className="p-3.5 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-900/5 dark:shadow-black/40 ring-1 ring-slate-100 dark:ring-white/10">
                <img src="/logo.png" alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
              </div>
            </div>
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wider uppercase mb-3 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Hệ Thống Tra Cứu Điểm &amp; Phân Tích Đề Thi
            </div>

            <div className="relative inline-block fade-in">
              <h1 
                className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight px-4 z-10 relative modern-title pb-2 max-w-4xl"
              >
                {examName}
              </h1>
            </div>
          </div>

          <div className="mb-8">
            <ExamTypeTabs active={examType} onChange={handleExamTypeChange} counts={examCounts} />
          </div>
          
          {/* FORM */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-2xl px-2 flex flex-col items-center gap-5">
            <div className="w-full rounded-3xl bg-white/90 dark:bg-slate-900/85 backdrop-blur-2xl p-6 sm:p-8 flex flex-col gap-6 fade-in border border-slate-200/80 dark:border-slate-800/90 shadow-xl shadow-slate-900/5 dark:shadow-2xl dark:shadow-black/60 transition-all duration-300 hover:border-blue-500/30">
              <div className="flex flex-col gap-2 w-full">
              
              <div className="flex-1 flex flex-col gap-2.5 relative w-full">
                <label htmlFor="lookup-name" className="pl-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tra cứu kết quả thí sinh
                </label>
                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors duration-200 pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Nhập họ và tên thí sinh (ví dụ: Nguyễn Văn A)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-14 pr-5 py-4 sm:py-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-semibold text-base sm:text-lg transition-all bg-slate-50/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950/90 outline-none shadow-xs"
                  />
                </div>
                
                {/* Suggestions Dropdown */}
                {searchQuery.trim() && searchResults.type === 'success' && searchResults.data.length > 0 && (
                  <div className="absolute top-[100%] mt-2 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200 divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.data.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-5 sm:px-6 py-3.5 hover:bg-blue-50/70 dark:hover:bg-slate-800/70 transition-all flex items-center justify-between gap-3 group/item cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover/item:scale-105 group-hover/item:bg-blue-600 group-hover/item:text-white transition-all duration-200 shrink-0">
                            <Search className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors truncate">{student.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">#{student.stt}</span>
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
              className="w-full sm:w-auto sm:min-w-[220px] sm:mx-auto mt-1 px-8 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:scale-98 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm sm:text-base tracking-wider flex items-center gap-2.5 justify-center group cursor-pointer"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" />
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
          disabled={isExportingPDF}
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-white bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 dark:hover:bg-indigo-600 font-bold transition-all px-4 sm:px-5 py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-sm shadow-xs disabled:opacity-60 cursor-pointer"
        >
          {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isExportingPDF ? 'Đang tạo PDF...' : 'Xuất Phiếu Điểm'}</span>
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
              <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center relative">
                {studentRankInfo && (studentRankInfo.rankTp === 1 || studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1) ? (
                  <span className="text-3xl">👑</span>
                ) : studentRankInfo && (studentRankInfo.rankTp === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2) ? (
                  <span className="text-3xl">🥈</span>
                ) : (
                  <>
                    <img 
                      src={`https://robohash.org/${encodeURIComponent(selectedStudent.name)}?set=set4&bgset=bg1`}
                      alt="Avatar" 
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover scale-110"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div 
                      style={{ display: 'none' }}
                      className="w-full h-full items-center justify-center font-black text-lg sm:text-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-inner"
                    >
                      {selectedStudent.name.trim().split(/\s+/).map(n => n[0]).slice(-2).join('').toUpperCase()}
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedStudent.name}
                  </h2>
                  {sbdMap?.[selectedStudent.name] && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
                      SBD: {sbdMap[selectedStudent.name]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Mã thí sinh: #{selectedStudent.stt.toString().padStart(4, '0')}</span>
                  {studentHistory.length > 1 && (
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
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
            {/* Vùng kiến thức theo CSV chuẩn */}
            {(() => {
              const wrongSet = new Set(selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []);
              const missingSet = new Set(selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []);

              // Compute stats for each domain and topic
              const parsedDomains = knowledgeStructure.domains.map(dom => {
                const topics = dom.topics.map(t => {
                  const wrong = t.qNums.filter(q => wrongSet.has(q)).length;
                  const missing = t.qNums.filter(q => missingSet.has(q)).length;
                  const correct = t.count - wrong - missing;
                  const pct = t.count > 0 ? Math.round((correct / t.count) * 100) : 0;
                  return {
                    ...t,
                    correct,
                    wrong,
                    missing,
                    pct,
                  };
                });

                const total = dom.total;
                const wrong = dom.qNums.filter(q => wrongSet.has(q)).length;
                const missing = dom.qNums.filter(q => missingSet.has(q)).length;
                const correct = total - wrong - missing;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

                return {
                  ...dom,
                  topics,
                  correct,
                  wrong,
                  missing,
                  pct,
                };
              });

              // Filter domains according to knowledgeFilter
              const filteredDomains = parsedDomains.filter(d => {
                if (knowledgeFilter === 'strong') return d.pct >= 80;
                if (knowledgeFilter === 'medium') return d.pct >= 50 && d.pct < 80;
                if (knowledgeFilter === 'weak') return d.pct < 50;
                return true;
              });

              const overallTotal = parsedDomains.reduce((s, d) => s + d.total, 0);
              const overallCorrect = parsedDomains.reduce((s, d) => s + d.correct, 0);
              const overallWrong = parsedDomains.reduce((s, d) => s + d.wrong, 0);
              const overallMissing = parsedDomains.reduce((s, d) => s + d.missing, 0);
              const overallPct = overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0;

              const getPctColor = (pct: number) => {
                if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
                if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
                return 'text-rose-600 dark:text-rose-400';
              };

              const getBarGradient = (pct: number) => {
                if (pct >= 80) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
                if (pct >= 50) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
                return 'bg-gradient-to-r from-rose-500 to-rose-600';
              };

              return (
                <div className="card overflow-hidden w-full min-w-0 shadow-lg border border-slate-200/80 dark:border-slate-800">
                  {/* Card Header & Filter Bar */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col gap-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-emerald-500 shrink-0" />
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                            Số Câu Đúng Theo Vùng Kiến Thức (Ma Trận CSV)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Tổng số câu đúng: <span className={`font-black text-sm ${getPctColor(overallPct)}`}>{overallCorrect}/{overallTotal} câu ({overallPct}%)</span>
                        </p>
                      </div>

                      {/* Summary Stat Badges */}
                      <div className="flex items-center flex-wrap gap-2 text-xs font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {overallCorrect} Đúng
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> {overallWrong} Sai
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 flex items-center gap-1">
                          - {overallMissing} Bỏ trống
                        </span>
                      </div>
                    </div>

                    {/* Filter Pills and View Mode Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
                        <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                          <Filter className="w-3.5 h-3.5" /> Lọc:
                        </span>
                        <button
                          type="button"
                          onClick={() => setKnowledgeFilter('all')}
                          className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                          Tất cả ({parsedDomains.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setKnowledgeFilter('strong')}
                          className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'strong' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                          Tốt (≥80%) ({parsedDomains.filter(d => d.pct >= 80).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setKnowledgeFilter('medium')}
                          className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'medium' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                          Khá (50-79%) ({parsedDomains.filter(d => d.pct >= 50 && d.pct < 80).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setKnowledgeFilter('weak')}
                          className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'weak' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                        >
                          Yếu (&lt;50%) ({parsedDomains.filter(d => d.pct < 50).length})
                        </button>
                      </div>

                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <button
                          type="button"
                          onClick={() => setKnowledgeViewMode('cards')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${knowledgeViewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" /> Dạng Thẻ
                        </button>
                        <button
                          type="button"
                          onClick={() => setKnowledgeViewMode('table')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${knowledgeViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                        >
                          <Table className="w-3.5 h-3.5" /> Dạng Bảng
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40">
                    {filteredDomains.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 italic">
                        Không có vùng kiến thức nào phù hợp với bộ lọc đã chọn.
                      </div>
                    ) : knowledgeViewMode === 'cards' ? (
                      /* Grid Cards View */
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredDomains.map(dom => (
                          <div
                            key={dom.domain}
                            className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/80 shadow-xs flex flex-col gap-3"
                          >
                            {/* Domain Header */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <h4 className={`font-black text-xs sm:text-sm uppercase tracking-wide ${dom.color || 'text-indigo-700'}`}>
                                    {dom.domain}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">
                                    {dom.total} câu ({dom.qNums[0]} - {dom.qNums[dom.qNums.length - 1]})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${getPctColor(dom.pct)}`}>
                                    {dom.correct}/{dom.total} đúng
                                  </span>
                                  <span className={`text-xs sm:text-sm font-black tabular-nums ${getPctColor(dom.pct)}`}>
                                    {dom.pct}%
                                  </span>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getBarGradient(dom.pct)}`}
                                  style={{ width: `${dom.pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Subtopics and Question Badges */}
                            <div className="flex flex-col gap-2 pt-1">
                              {dom.topics.map(t => (
                                <div
                                  key={t.name}
                                  className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{t.name}</span>
                                    <span className={`font-bold tabular-nums shrink-0 ${getPctColor(t.pct)}`}>
                                      {t.correct}/{t.count} ({t.pct}%)
                                    </span>
                                  </div>
                                  {/* Clickable Question Badges */}
                                  <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                    {t.qNums.map(q => {
                                      const isWrong = wrongSet.has(q);
                                      const isMissed = missingSet.has(q);
                                      let badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 hover:bg-emerald-100';
                                      let symbol = '✓';
                                      if (isWrong) {
                                        badgeStyle = 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 hover:bg-rose-200 font-bold';
                                        symbol = '✗';
                                      } else if (isMissed) {
                                        badgeStyle = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 hover:bg-amber-200 font-bold';
                                        symbol = '-';
                                      }

                                      return (
                                        <button
                                          key={q}
                                          type="button"
                                          onClick={() => setViewQuestionKey(`Câu ${q}`)}
                                          className={`px-1.5 py-0.5 rounded text-[10.5px] border transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${badgeStyle}`}
                                          title={`Câu ${q}: ${isWrong ? 'Làm sai' : isMissed ? 'Bỏ trống' : 'Làm đúng'} - Nhấp để xem chi tiết`}
                                        >
                                          <span>Câu {q}</span>
                                          <span className="text-[10px] opacity-80">{symbol}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Table View */
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700">Vùng Kiến Thức</th>
                              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">Chuyên Đề</th>
                              <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center">Tổng câu</th>
                              <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-emerald-600">Đúng</th>
                              <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-rose-500">Sai</th>
                              <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-amber-600">Bỏ trống</th>
                              <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 w-36">Tỷ lệ đúng</th>
                              <th className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700">Câu hỏi (nhấp xem đề)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredDomains.map(dom => {
                              return dom.topics.map((t, idx) => (
                                <tr key={`${dom.domain}-${t.name}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                  {idx === 0 && (
                                    <td
                                      rowSpan={dom.topics.length}
                                      className="px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-100 bg-slate-50/40 dark:bg-slate-800/40 align-middle border-r border-slate-200/60 dark:border-slate-700/60"
                                    >
                                      <div className={`${dom.color || 'text-indigo-600'} font-black text-xs uppercase`}>
                                        {dom.domain}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                        {dom.correct}/{dom.total} ({dom.pct}%)
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">{t.name}</td>
                                  <td className="px-2.5 py-2.5 text-center font-semibold">{t.count}</td>
                                  <td className="px-2.5 py-2.5 text-center font-bold text-emerald-600">{t.correct}</td>
                                  <td className="px-2.5 py-2.5 text-center font-bold text-rose-500">{t.wrong}</td>
                                  <td className="px-2.5 py-2.5 text-center font-bold text-amber-600">{t.missing}</td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className={`h-full ${getBarGradient(t.pct)}`} style={{ width: `${t.pct}%` }} />
                                      </div>
                                      <span className={`font-bold tabular-nums text-[11px] ${getPctColor(t.pct)}`}>{t.pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <div className="flex items-center flex-wrap gap-1">
                                      {t.qNums.map(q => {
                                        const isWrong = wrongSet.has(q);
                                        const isMissed = missingSet.has(q);
                                        let style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                        let sym = '✓';
                                        if (isWrong) {
                                          style = 'bg-rose-100 text-rose-700 border-rose-300 font-bold';
                                          sym = '✗';
                                        } else if (isMissed) {
                                          style = 'bg-amber-100 text-amber-700 border-amber-300 font-bold';
                                          sym = '-';
                                        }
                                        return (
                                          <button
                                            key={q}
                                            type="button"
                                            onClick={() => setViewQuestionKey(`Câu ${q}`)}
                                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-transform hover:scale-110 ${style}`}
                                            title={`Câu ${q}: Nhấp xem chi tiết`}
                                          >
                                            {q} {sym}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                      knowledgeCsv={knowledgeCsv}
                      domains={knowledgeStructure.domains}
                      maxQuestionNum={maxExamQuestionNum}
                      onQuestionClick={(qNum) => setViewQuestionKey(`Câu ${qNum}`)}
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
