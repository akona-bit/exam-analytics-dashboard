import React, { Suspense, lazy, useMemo, useState, useRef } from 'react';
import { MetricKey, QuestionData, StudentData } from '../../types';
import { EXAM_LABEL, METRIC_LABEL, QUESTIONS_TOTAL, subjectMax } from '../../lib/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { 
  Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, 
  FileSpreadsheet, Key, Target, PieChart as PieChartIcon, Check, CheckCircle2, Layers, Filter, 
  LayoutGrid, Table, Loader2, Lock, Eye, EyeOff, User, Award, BookmarkCheck, ArrowUpDown, HelpCircle
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
import { CelebrationOverlay } from './CelebrationOverlay';
import { parseKnowledgeCSV, DEFAULT_KNOWLEDGE_CSV, buildStandard120Structure, getQuestionKnowledgeInfo } from '../../lib/knowledgeStructure';
import { getExamCodeQuestionNum } from '../../lib/examCodesMapping';

const AbilityDistribution = lazy(() => import('./AbilityDistribution').then(m => ({ default: m.AbilityDistribution })));
const ClassAnalytics = lazy(() => import('./ClassAnalytics').then(m => ({ default: m.ClassAnalytics })));

interface Props {
  questions: QuestionData[];
  students: StudentData[];
  examName: string;
  knowledgeCsv?: string;
  answerLink?: string;
  nextExamDate?: string;
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

export function Dashboard({ questions, students, examName, knowledgeCsv, answerLink, nextExamDate, visibleParts }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordSbd, setPasswordSbd] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [progressMetric, setProgressMetric] = useState<MetricKey>('tho');
  const [progressSubject, setProgressSubject] = useState<'Toán' | 'TDKH'>('Toán');
  const [showCelebration, setShowCelebration] = useState(false);
  const [classMetric, setClassMetric] = useState<MetricKey>('irt');
  const [studentTab, setStudentTab] = useState<'overview' | 'review' | 'history' | 'class'>('overview');
  const [radarMode, setRadarMode] = useState<'compare' | 'parts'>('compare');
  /**
   * Thang điểm dùng cho biểu đồ cột "Điểm Số Theo Từng Môn" và radar "So với TB Lớp".
   * Mặc định là thang chuẩn hoá IRT 1200 điểm theo kỳ thi ĐGNL ĐHQG TP.HCM (VNU-HCM) Đợt 1.
   */
  const [subjectMetric, setSubjectMetric] = useState<MetricKey>('irt');
  const [knowledgeFilter, setKnowledgeFilter] = useState<'all' | 'strong' | 'medium' | 'weak'>('all');
  const [knowledgeViewMode, setKnowledgeViewMode] = useState<'cards' | 'table'>('cards');
  /** Bộ lọc bảng 120 câu: xem tất cả hay chỉ nhóm trạng thái. */
  const [questionStatusFilter, setQuestionStatusFilter] = useState<'all' | 'correct' | 'wrong' | 'missing'>('all');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState<'all' | 'TV' | 'TA' | 'TO' | 'TDKH'>('all');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const celebratedRef = React.useRef<Set<string>>(new Set());

  /** Số câu của đề thi — luôn lấy từ bảng `questions`, không suy từ `responses`. */
  const maxExamQuestionNum = useMemo(() => {
    const fromQuestions = questions.length > 0 ? questions.length : QUESTIONS_TOTAL;
    if (selectedStudent?.responses && selectedStudent.responses.length > 0) {
      const studentMax = Math.max(...selectedStudent.responses.map(r => r.question_num));
      if (studentMax > fromQuestions) return studentMax;
    }
    return fromQuestions;
  }, [questions, selectedStudent]);

  // Parse knowledge structure based on CSV and active question scale
  const knowledgeStructure = useMemo(() => {
    return parseKnowledgeCSV(knowledgeCsv || DEFAULT_KNOWLEDGE_CSV, maxExamQuestionNum);
  }, [knowledgeCsv, maxExamQuestionNum]);

  const autoCompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const lower = searchQuery.toLowerCase().trim();

    // Khi người dùng đang nhập email/gmail thì KHÔNG gợi ý tên thí sinh
    if (lower.includes('@') || lower.includes('gmail') || lower.endsWith('.com')) return [];

    const uniqueKeys = new Set<string>();
    const suggestions: (StudentData & { customDisplayName?: string })[] = [];

    // Chỉ gợi ý theo tên thí sinh khi tìm kiếm bằng tên.
    // TUYỆT ĐỐI không gợi ý theo email hoặc SBD để bảo vệ quyền riêng tư
    // và tránh lộ danh tính thí sinh khi gõ email.
    for (const s of students) {
      // Không có tên thật (name trùng SBD, chỉ toàn chữ số) → bỏ qua, tránh lộ SBD.
      const realName = (s.name || '').trim();
      if (!realName || /^\d+$/.test(realName)) continue;

      if (realName.toLowerCase().includes(lower)) {
        const key = realName.toLowerCase();
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          suggestions.push({ ...s, name: realName });
        }
      }
    }

    return suggestions.slice(0, 5);
  }, [searchQuery, students]);

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
      // Small delay to allow any pending DOM paint or layout stabilization
      await new Promise(r => setTimeout(r, 100));

      const elementHeight = dashboardElement.offsetHeight || 2000;
      // Auto-scale to ensure we don't exceed browser canvas limits (canvas max dimensions)
      const targetScale = elementHeight > 3500 ? 1.5 : 2;

      const canvas = await html2canvas(dashboardElement, {
        scale: targetScale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        imageTimeout: 8000,
        onclone: (clonedDoc) => {
          // Remove dark mode in clone so print/export is always pristine high-contrast light
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          // Ensure container has clear explicit sizing in cloned DOM
          const clonedContainer = clonedDoc.getElementById('dashboard-content');
          if (clonedContainer) {
            clonedContainer.style.width = '1140px';
            clonedContainer.style.maxWidth = '1140px';
            clonedContainer.style.backgroundColor = '#ffffff';
            clonedContainer.style.padding = '12px';
            clonedContainer.style.borderRadius = '16px';
          }

          // Handle avatar: if loaded, convert to dataURL or fallback safely to initials
          const clonedAvatar = clonedDoc.querySelector('img[alt="Avatar"]') as HTMLImageElement | null;
          const originalAvatar = document.querySelector('img[alt="Avatar"]') as HTMLImageElement | null;
          if (clonedAvatar) {
            let inlined = false;
            if (originalAvatar && originalAvatar.complete && originalAvatar.naturalWidth > 0) {
              try {
                const c = document.createElement('canvas');
                c.width = originalAvatar.naturalWidth;
                c.height = originalAvatar.naturalHeight;
                const ctx = c.getContext('2d');
                if (ctx) {
                  ctx.drawImage(originalAvatar, 0, 0);
                  clonedAvatar.src = c.toDataURL('image/png');
                  inlined = true;
                }
              } catch {
                inlined = false;
              }
            }
            if (!inlined) {
              clonedAvatar.style.display = 'none';
              const fallback = clonedAvatar.nextElementSibling as HTMLElement | null;
              if (fallback) {
                fallback.style.display = 'flex';
                fallback.style.borderRadius = '14px';
              }
            }
          }
        },
        ignoreElements: (element) => {
          return element.classList?.contains('no-pdf') || element.getAttribute('data-no-pdf') === 'true';
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas rendering produced empty image');
      }

      const imgData = canvas.toDataURL('image/png');
      if (!imgData || imgData === 'data:,' || imgData.length < 100) {
        throw new Error('Canvas data URL is invalid');
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const safeName = (selectedStudent.name || 'Thi_Sinh')
        .trim()
        .replace(/\s+/g, '_')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '');

      pdf.save(`Phieu_Diem_${safeName || 'Thi_Sinh'}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Đã có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
    } finally {
      setIsExportingPDF(false);
    }
  };


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
        const mk = progressMetric;
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

  /**
   * `responses` chỉ chứa câu sai/bỏ trống (`failedOnly`), nên KHÔNG thể suy ra tổng
   * số câu từ `responses.length` — làm vậy sẽ ra 0% đúng. Tổng số câu phải lấy từ
   * `maxExamQuestionNum` (số câu của đề thi), rồi trừ đi phần sai/bỏ trống.
   */
  const correctCount = useMemo(() => {
    const total = maxExamQuestionNum;
    if (!selectedStudent || total <= 0) return { correct: 0, total: 0 };
    const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
    const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
    return { correct: Math.max(0, total - wrong - missing), total };
  }, [selectedStudent, maxExamQuestionNum]);

  const progressChartData = useMemo(() => {
    return studentHistory.map((s, i) => {
      const n = i + 1;
      const cd = classProgressData.find(c => c.name === `Lần ${n}`);
      const mk = progressMetric;
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
      const data: Record<string, string | number> = { name: `Lần ${i + 1}` };
      if (visibleParts?.tv !== false) data['Tiếng Việt'] = s[subjectMetric].tv || 0;
      if (visibleParts?.ta !== false) data['Tiếng Anh'] = s[subjectMetric].ta || 0;
      if (visibleParts?.toan !== false) data['Toán'] = s[subjectMetric].toan || 0;
      if (visibleParts?.tdkh !== false) data['TDKH'] = s[subjectMetric].tdkh || 0;
      return data;
    });
  }, [studentHistory, visibleParts, subjectMetric]);
  const rankData = useMemo(() => {
    const groups = new Map<string, typeof students[0] & { totalTho: number, totalIrt: number }>();
    for (const a of students) {
      const key = a.email || a.name;
      const ex = groups.get(key);
      const thoScore = (visibleParts?.tv !== false ? (a.tho.tv || 0) : 0) + (visibleParts?.ta !== false ? (a.tho.ta || 0) : 0) + (visibleParts?.toan !== false ? (a.tho.toan || 0) : 0) + (visibleParts?.tdkh !== false ? (a.tho.tdkh || 0) : 0);
      const irtScore = (visibleParts?.tv !== false ? (a.irt.tv || 0) : 0) + (visibleParts?.ta !== false ? (a.irt.ta || 0) : 0) + (visibleParts?.toan !== false ? (a.irt.toan || 0) : 0) + (visibleParts?.tdkh !== false ? (a.irt.tdkh || 0) : 0);

      if (!ex) {
        groups.set(key, { ...a, totalTho: thoScore, totalIrt: irtScore });
      } else {
        ex.totalTho = Math.max(ex.totalTho, thoScore);
        ex.totalIrt = Math.max(ex.totalIrt, irtScore);
      }
    }
    const arr = Array.from(groups.values());
    return {
      tho: [...arr].sort((a, b) => b.totalTho - a.totalTho),
      irt: [...arr].sort((a, b) => b.totalIrt - a.totalIrt),
    };
  }, [students, visibleParts]);

  const studentRankInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const key = selectedStudent.email || selectedStudent.name;
    const rankTho = rankData.tho.findIndex(s => (s.email || s.name) === key) + 1;
    const rankIrt = rankData.irt.findIndex(s => (s.email || s.name) === key) + 1;

    return {
      rankTho: rankTho > 0 ? rankTho : null,
      rankIrt: rankIrt > 0 ? rankIrt : null,
      totalTho: rankTho > 0 ? rankData.tho[rankTho - 1].totalTho : 0,
      totalIrt: rankIrt > 0 ? rankData.irt[rankIrt - 1].totalIrt : 0,
    };
  }, [selectedStudent, rankData]);

  React.useEffect(() => {
    if (studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankTho === 2 ||
                            studentRankInfo.rankIrt === 1 || studentRankInfo.rankIrt === 2) && selectedStudent) {
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
    const metric = subjectMetric;
    const getAvg = (subj: 'tv' | 'ta' | 'toan' | 'tdkh') => {
      let sum = 0, count = 0;
      // `!== null` chứ không phải `> 0`: học sinh 0đ vẫn phải vào mẫu số, nếu không
      // điểm trung bình của lớp bị thổi lên.
      students.forEach(x => {
        const v = x[metric][subj];
        if (v !== null) { sum += v; count++; }
      });
      return count ? +(sum / count).toFixed(2) : 0;
    };

    const s = selectedStudent;
    const res: Record<string, string | number>[] = [];
    if (visibleParts?.tv !== false) {
      res.push({ subject: 'Tiếng Việt', 'Điểm Của Bạn': s[metric].tv || 0, 'Trung Bình': getAvg('tv') });
    }
    if (visibleParts?.ta !== false) {
      res.push({ subject: 'Tiếng Anh', 'Điểm Của Bạn': s[metric].ta || 0, 'Trung Bình': getAvg('ta') });
    }
    if (visibleParts?.toan !== false) {
      res.push({ subject: 'Toán', 'Điểm Của Bạn': s[metric].toan || 0, 'Trung Bình': getAvg('toan') });
    }
    if (visibleParts?.tdkh !== false) {
      res.push({ subject: 'Khoa Học', 'Điểm Của Bạn': s[metric].tdkh || 0, 'Trung Bình': getAvg('tdkh') });
    }
    return res;
  }, [selectedStudent, students, visibleParts, subjectMetric]);

  /**
   * Radar "Thành phần điểm": Thô (0–30 câu đúng) và IRT (0–300 điểm) là hai thang
   * khác nhau nên vẽ thẳng lên cùng một trục sẽ bị IRT áp đảo. Quy về % đạt trước.
   */
  const radarDataParts = useMemo(() => {
    if (!selectedStudent) return [];
    const s = selectedStudent;
    const asPct = (v: number | null | undefined, metric: MetricKey) =>
      Math.round(((v ?? 0) / subjectMax(metric)) * 1000) / 10;
    const res: Record<string, string | number>[] = [];
    const push = (subject: string, tho: number | null | undefined, irt: number | null | undefined) => {
      res.push({ subject, '% Điểm Thô': asPct(tho, 'tho'), '% Điểm Neo Đề': asPct(irt, 'irt') });
    };
    if (visibleParts?.tv !== false) push('Tiếng Việt', s.tho.tv, s.irt.tv);
    if (visibleParts?.ta !== false) push('Tiếng Anh', s.tho.ta, s.irt.ta);
    if (visibleParts?.toan !== false) push('Toán', s.tho.toan, s.irt.toan);
    if (visibleParts?.tdkh !== false) push('Khoa Học', s.tho.tdkh, s.irt.tdkh);
    return res;
  }, [selectedStudent, visibleParts]);

  const tooltipStyle = { borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const query = searchQuery.trim();
    const pwd = passwordSbd.trim();

    if (!query) {
      setAuthError('Vui lòng nhập tên hoặc email thí sinh.');
      return;
    }
    if (!pwd) {
      setAuthError('Vui lòng nhập mật khẩu (Số Báo Danh - SBD).');
      passwordInputRef.current?.focus();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const lowerPwd = pwd.toLowerCase();

    const matches = (needle: string, field: (s: StudentData) => string | null | undefined) =>
      students.filter(s => (field(s) || '').toLowerCase().includes(needle));

    // 1. Khớp chính xác: tên, email, SBD hoặc STT
    const key = (s: StudentData) => s.email || s.name;
    let candidate = students.find(s =>
      s.name.toLowerCase() === lowerQuery ||
      (!!s.email && s.email.toLowerCase() === lowerQuery) ||
      (!!s.sbd && s.sbd.toLowerCase() === lowerQuery) ||
      s.stt.toString() === lowerQuery
    );

    // 2. Khớp một phần (gõ dở tên, gõ dở SBD)
    if (!candidate) {
      const partial = matches(lowerQuery, s => s.name);
      candidate =
        partial[0] ||
        matches(lowerQuery, s => s.sbd)[0] ||
        matches(lowerQuery, s => s.email)[0] ||
        null;
    }

    // 3. Người dùng có thể chỉ gõ SBD ở ô tên; SBD là duy nhất nên thử tiếp với mật khẩu
    if (!candidate) {
      candidate = students.find(s =>
        key(s).toLowerCase() === lowerPwd ||
        (!!s.sbd && s.sbd.toLowerCase() === lowerPwd) ||
        (!!s.email && s.email.toLowerCase() === lowerPwd) ||
        s.stt.toString() === lowerPwd
      );
      if (candidate && query && !/^\d+$/.test(query)) {
        candidate = { ...candidate, customDisplayName: query };
      }
    }

    if (!candidate) {
      setAuthError('Không tìm thấy thí sinh với thông tin này. Vui lòng kiểm tra lại Tên/Email và Số Báo Danh (SBD).');
      return;
    }

    // 4. Xác thực — mật khẩu là SBD của chính thí sinh đó
    const validPasswords = [candidate.sbd, candidate.name, candidate.email, candidate.stt.toString()]
      .filter(Boolean)
      .map(x => String(x).trim().toLowerCase());

    if (!validPasswords.includes(lowerPwd)) {
      setAuthError('Mật khẩu không chính xác. Mật khẩu mặc định là Số Báo Danh (SBD) của thí sinh.');
      return;
    }

    // Success
    setSelectedStudent(candidate);
    setPasswordSbd('');
    setAuthError(null);
  };

  if (!selectedStudent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] fade-in relative w-full">
        
        <div className="relative z-10 w-full flex flex-col items-center px-4">
          
          {/* TITLE & DESCRIPTION */}
          <div className="text-center mb-6 flex flex-col items-center">
            <div className="mb-4 fade-in transform transition-all hover:scale-105 duration-300">
              <div className="p-3.5 rounded-3xl bg-white/85 backdrop-blur-xl border border-white/90 shadow-xl shadow-indigo-900/10 ring-1 ring-white/80">
                <img src="/logo.png" alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
              </div>
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
          </div>
          
          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="relative w-full max-w-xl px-2 flex flex-col items-center gap-5">
            <div className="w-full rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-8 flex flex-col gap-5 fade-in border border-slate-200/80 dark:border-slate-800 shadow-[0_15px_50px_rgba(30,40,90,0.18)] transition-all duration-300">
              
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                    Tra Cứu Điểm &amp; Phân Tích
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nhập tên hoặc email, mật khẩu là Số Báo Danh (SBD)
                  </p>
                </div>
              </div>

              {/* Error Alert Banner */}
              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                  <span>{authError}</span>
                </div>
              )}

              {/* FIELD 1: Name or Email */}
              <div className="flex flex-col gap-2 relative w-full">
                <label htmlFor="lookup-name" className="pl-1 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Tên hoặc Email</span>
                  <span className="text-[11px] font-normal text-slate-400">Ví dụ: Nguyễn Văn A hoặc email</span>
                </label>
                <div className="relative group">
                  <User className="absolute left-4.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Nhập tên hoặc email của bạn..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-13 pr-4 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 text-slate-900 dark:text-white placeholder:text-slate-400 font-semibold text-sm sm:text-base transition-all bg-white dark:bg-slate-800/80 outline-none shadow-xs"
                  />
                </div>

                {/* Autocomplete Suggestions */}
                {searchQuery.trim().length >= 2 && autoCompleteSuggestions.length > 0 && (
                  <div className="w-full mt-1 max-h-64 overflow-y-auto overscroll-contain bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200 divide-y divide-slate-100 dark:divide-slate-800">
                    {autoCompleteSuggestions.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          // Không tự điền SBD (mật khẩu) từ gợi ý — thí sinh phải tự nhập.
                          setSearchQuery(student.customDisplayName || student.name);
                          setAuthError(null);
                          setTimeout(() => {
                            passwordInputRef.current?.focus();
                          }, 50);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-indigo-50/70 dark:hover:bg-slate-800/70 transition-all flex items-center justify-between gap-3 group/item cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover/item:scale-105 group-hover/item:bg-indigo-600 group-hover/item:text-white transition-all shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors">
                              {student.customDisplayName || student.name}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-indigo-500 font-bold">Chọn thí sinh →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FIELD 2: Password is SBD */}
              <div className="flex flex-col gap-2 relative w-full">
                <label htmlFor="lookup-password" className="pl-1 text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mật khẩu (Số Báo Danh - SBD)</span>
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors pointer-events-none" />
                  <input
                    ref={passwordInputRef}
                    id="lookup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập Số Báo Danh của bạn..."
                    value={passwordSbd}
                    onChange={(e) => {
                      setPasswordSbd(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    autoComplete="current-password"
                    className="w-full pl-13 pr-12 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 text-slate-900 dark:text-white placeholder:text-slate-400 font-semibold text-sm sm:text-base transition-all bg-white dark:bg-slate-800/80 outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="pl-1 flex items-start gap-1.5 text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Mật khẩu chính là Số Báo Danh (SBD) đã được cấp cho bạn.</span>
                </p>
              </div>

              {/* BUTTON */}
              <button 
                type="submit"
                disabled={!searchQuery.trim()}
                className="w-full mt-2 px-8 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:scale-98 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm sm:text-base tracking-wider flex items-center gap-2.5 justify-center group cursor-pointer"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-200" />
                ĐĂNG NHẬP TRA CỨU KẾT QUẢ
              </button>
            </div>
          </form>

        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 pb-8 fade-in max-w-6xl mx-auto w-full min-w-0">
      {selectedStudent && studentRankInfo && (
        <CelebrationOverlay 
          show={showCelebration} 
          rank={studentRankInfo.rankIrt || 1}
          name={selectedStudent.name}
          onComplete={() => setShowCelebration(false)}
        />
      )}
      <div className="mb-2">
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
            const isTop1 = studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1;
            const isTop2 = !isTop1 && (studentRankInfo.rankIrt === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2);
            
            if (isTop1) {
              return (
                <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-white shadow-sm font-bold">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">👑</span>
                    <span className="text-xs sm:text-sm font-extrabold tracking-wide">
                      Tuyệt vời! <span className="underline decoration-white/60">{selectedStudent.customDisplayName || (selectedStudent.name.match(/^\d+$/) ? `Thí sinh ${selectedStudent.name}` : selectedStudent.name)}</span> xuất sắc đạt danh hiệu <span className="bg-white/20 px-2 py-0.5 rounded-md text-white font-black uppercase text-xs">Thủ Khoa</span> kỳ thi này!
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
                      Chúc mừng! <span className="underline decoration-slate-800/40">{selectedStudent.customDisplayName || (selectedStudent.name.match(/^\d+$/) ? `Thí sinh ${selectedStudent.name}` : selectedStudent.name)}</span> xuất sắc đạt danh hiệu <span className="bg-slate-900/10 px-2 py-0.5 rounded-md text-slate-900 font-black uppercase text-xs">Á Khoa</span> kỳ thi này!
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
                {studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1) ? (
                  <span className="text-3xl">👑</span>
                ) : studentRankInfo && (studentRankInfo.rankIrt === 2 || studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2) ? (
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
                      {(selectedStudent.customDisplayName || selectedStudent.name).trim().split(/\s+/).map(n => n[0]).slice(-2).join('').toUpperCase()}
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedStudent.customDisplayName || selectedStudent.name}
                  </h2>
                  {selectedStudent.sbd && (
                    <span className="px-2.5 py-0.5 text-xs font-black rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                      SBD: {selectedStudent.sbd}
                    </span>
                  )}
                  {selectedStudent.maDe && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      Mã đề {selectedStudent.maDe}
                    </span>
                  )}
                  {selectedStudent.gender && (
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {selectedStudent.gender}
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
                {EXAM_LABEL}
              </span>
            </div>
          </div>

          {/* Compact Scoreboard Bento Grid - Diagnostic Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-1">
            {/* Tổng Câu Đúng */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Tổng Câu Đúng</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                  {correctCount.total > 0 ? `${Math.round((correctCount.correct / correctCount.total) * 100)}%` : '—'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {correctCount.correct} <span className="text-sm sm:text-base font-bold text-slate-400 dark:text-slate-500">/ {correctCount.total}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-100/80 dark:border-emerald-900/40 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
                <span>TV: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.tv ?? 0}/30</strong></span>
                <span>TA: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.ta ?? 0}/30</strong></span>
                <span>TO: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.toan ?? 0}/30</strong></span>
                <span>KH: <strong className="text-slate-700 dark:text-slate-200">{selectedStudent.tho.tdkh ?? 0}/30</strong></span>
              </div>
            </div>

            {/* Số Câu Làm Sai */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Số Câu Làm Sai</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-rose-600 text-white shadow-xs">
                  Cần xem lại
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tight">
                {selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0} <span className="text-sm font-semibold text-slate-400">câu</span>
              </div>
              <div className="mt-2 pt-2 border-t border-rose-100/80 dark:border-rose-900/40 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Xem chi tiết các câu sai theo mã đề bên dưới
              </div>
            </div>

            {/* Số Câu Bỏ Trống */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Số Câu Bỏ Trống</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-amber-600 text-white shadow-xs">
                  Chưa làm
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
                {selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0} <span className="text-sm font-semibold text-slate-400">câu</span>
              </div>
              <div className="mt-2 pt-2 border-t border-amber-100/80 dark:border-amber-900/40 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Các câu không tô hoặc bỏ trống trên phiếu làm bài
              </div>
            </div>

            {/* Thứ Hạng Số Câu Đúng */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 shadow-xs relative overflow-hidden group hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Thứ Hạng Số Câu</span>
                {studentRankInfo?.rankTho && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black bg-indigo-600 text-white shadow-xs">
                    Top {Math.max(1, Math.round((studentRankInfo.rankTho / students.length) * 100))}%
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tight">
                #{studentRankInfo?.rankTho ?? '-'} <span className="text-sm font-semibold text-slate-400">/ {students.length}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 text-[11px] text-slate-500 dark:text-slate-400">
                Xếp hạng theo tổng số câu đúng toàn khóa
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-700/60 mt-2 overflow-x-auto hide-scrollbar gap-1 sm:gap-2 no-pdf">
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
              <span>Câu Hỏi & Vùng Kiến Thức</span>
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
            {/* BẢNG ĐIỂM NEO ĐỀ CHUẨN HOÁ (MÔ HÌNH IRT THANG 1200 - CHUẨN ĐGNL ĐHQG-HCM ĐỢT 1) */}
            <section className="card p-5 sm:p-7 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-100 dark:border-slate-800 rounded-3xl shadow-[0_12px_40px_-5px_rgba(60,80,160,0.18)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md text-[10.5px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                          Chuẩn hóa IRT · VNU-HCM Đợt 1
                        </span>
                        <h3 className="font-black text-lg sm:text-xl text-slate-800 dark:text-white tracking-tight">
                          Bảng Điểm Neo Đề Chuẩn Hóa (Mô Hình IRT Thang 1200 - Chuẩn ĐGNL ĐHQG-HCM Đợt 1)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Quy đổi chuẩn hóa theo độ khó và độ phân biệt câu hỏi kỳ thi ĐGNL ĐHQG TP.HCM (VNU-HCM) Đợt 1 · Thang điểm tối đa: 1200 điểm
                      </p>
                    </div>
                  </div>

                  {/* Total IRT Score Pill */}
                  <div className="flex items-center gap-3 self-start sm:self-center bg-indigo-50/70 dark:bg-slate-800/80 px-5 py-2.5 rounded-2xl border border-indigo-100 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                        Tổng Điểm Neo Đề (VNU-HCM Đợt 1)
                      </span>
                      <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {((visibleParts?.tv !== false ? selectedStudent.irt.tv || 0 : 0) + 
                          (visibleParts?.ta !== false ? selectedStudent.irt.ta || 0 : 0) + 
                          (visibleParts?.toan !== false ? selectedStudent.irt.toan || 0 : 0) + 
                          (visibleParts?.tdkh !== false ? selectedStudent.irt.tdkh || 0 : 0)).toFixed(0)}{' '}
                        <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500">/ 1200</span>
                      </div>
                    </div>
                    {studentRankInfo?.rankIrt && (
                      <div className="pl-3 border-l border-indigo-200 dark:border-slate-700 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Hạng IRT
                        </span>
                        <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                          #{studentRankInfo.rankIrt}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 Subjects Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Tiếng Việt */}
                  {visibleParts?.tv !== false && (
                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-800/60 border border-amber-100 dark:border-slate-700 flex flex-col justify-between gap-3 hover:shadow-xs transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Phần 1: TV
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {selectedStudent.tho.tv ?? 0}/30 câu đúng
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Tiếng Việt</h4>
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                          {selectedStudent.irt.tv ?? 0}{' '}
                          <span className="text-xs font-semibold text-slate-400">/ 300 điểm</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-amber-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" 
                          style={{ width: `${Math.min(100, Math.round(((selectedStudent.irt.tv || 0) / 300) * 100))}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Tiếng Anh */}
                  {visibleParts?.ta !== false && (
                    <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-slate-800/60 border border-purple-100 dark:border-slate-700 flex flex-col justify-between gap-3 hover:shadow-xs transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                            Phần 2: TA
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {selectedStudent.tho.ta ?? 0}/30 câu đúng
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Tiếng Anh</h4>
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums mt-1">
                          {selectedStudent.irt.ta ?? 0}{' '}
                          <span className="text-xs font-semibold text-slate-400">/ 300 điểm</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-purple-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" 
                          style={{ width: `${Math.min(100, Math.round(((selectedStudent.irt.ta || 0) / 300) * 100))}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Toán học */}
                  {visibleParts?.toan !== false && (
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/60 border border-indigo-100 dark:border-slate-700 flex flex-col justify-between gap-3 hover:shadow-xs transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Phần 3: TO
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {selectedStudent.tho.toan ?? 0}/30 câu đúng
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Toán Học</h4>
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums mt-1">
                          {selectedStudent.irt.toan ?? 0}{' '}
                          <span className="text-xs font-semibold text-slate-400">/ 300 điểm</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-indigo-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" 
                          style={{ width: `${Math.min(100, Math.round(((selectedStudent.irt.toan || 0) / 300) * 100))}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Tư duy khoa học */}
                  {visibleParts?.tdkh !== false && (
                    <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-slate-800/60 border border-sky-100 dark:border-slate-700 flex flex-col justify-between gap-3 hover:shadow-xs transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                            Phần 4: TDKH
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            {selectedStudent.tho.tdkh ?? 0}/30 câu đúng
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white">Tư Duy Khoa Học</h4>
                        <div className="text-2xl font-black text-sky-600 dark:text-sky-400 tabular-nums mt-1">
                          {selectedStudent.irt.tdkh ?? 0}{' '}
                          <span className="text-xs font-semibold text-slate-400">/ 300 điểm</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-sky-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full" 
                          style={{ width: `${Math.min(100, Math.round(((selectedStudent.irt.tdkh || 0) / 300) * 100))}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Note & Explanation */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/70 border border-indigo-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                  <span className="text-base shrink-0">💡</span>
                  <p>
                    <strong className="text-indigo-900 dark:text-indigo-200">Cơ chế Neo Đề Chuẩn VNU-HCM Đợt 1:</strong> Điểm neo đề được tính toán theo mô hình lý thuyết ứng đáp câu hỏi (Item Response Theory - IRT 2PL/3PL), chuẩn hóa về thang điểm chuẩn 1200 điểm của kỳ thi Đánh giá năng lực ĐHQG TP.HCM (VNU-HCM) Đợt 1. Thang điểm 4 môn: Tiếng Việt (300đ), Tiếng Anh (300đ), Toán học (300đ), Tư duy khoa học (300đ). Khác với điểm thô chỉ đếm số lượng câu đúng đơn thuần, điểm neo đề phản ánh chính xác năng lực thực chất của thí sinh bằng cách gán trọng số độ khó và độ phân biệt riêng cho từng câu hỏi neo theo chuẩn đề thi VNU-HCM Đợt 1.
                  </p>
                </div>
              </div>
            </section>

            {/* Chọn thang điểm — dùng chung cho radar "So với TB Lớp" và biểu đồ cột bên cạnh */}
            <div className="flex flex-wrap items-center justify-between gap-3 card px-4 py-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Thang điểm đang hiển thị
              </p>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl" role="group" aria-label="Thang điểm">
                {(['tho', 'irt'] as MetricKey[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={subjectMetric === m}
                    onClick={() => setSubjectMetric(m)}
                    className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${subjectMetric === m ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    {METRIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
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
                        </defs>
                        <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Radar name="% Điểm Thô" dataKey="% Điểm Thô" stroke="#10b981" strokeWidth={2} fill="url(#colorTho)" fillOpacity={0.5} />
                        <Radar name="% Điểm Neo Đề" dataKey="% Điểm Neo Đề" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorIrt)" fillOpacity={0.5} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `${value}%`} />
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
                <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-0.5 mb-1">
                  {METRIC_LABEL[subjectMetric]}
                </p>
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
                      value={progressMetric} onChange={(e) => setProgressMetric(e.target.value as MetricKey)}>
                      <option value="tho">Điểm Thô</option>
                      <option value="irt">Điểm Neo Đề</option>
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
          <div className="flex flex-col gap-5 sm:gap-6 fade-in">
            {(() => {
              const wrongSet = new Set(selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []);
              const missingSet = new Set(selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []);

              // Structure with 4 Phan This -> Gom Nhoms -> Topics
              const activePhanThis = (knowledgeStructure?.phanThis && knowledgeStructure.phanThis.length > 0)
                ? knowledgeStructure.phanThis
                : buildStandard120Structure().phanThis;

              // Compute weak topics list for review
              const weakTopicsList: {
                subjectCode: string;
                subjectName: string;
                groupName: string;
                topicName: string;
                total: number;
                correct: number;
                wrong: number;
                missing: number;
                pct: number;
                wrongQNums: { q: number; status: 'wrong' | 'missing' }[];
                priority: 'high' | 'medium' | 'low';
                advice: string;
              }[] = [];

              for (const pt of activePhanThis) {
                for (const gn of pt.gomNhoms) {
                  for (const t of gn.topics) {
                    const wrongItems: { q: number; status: 'wrong' | 'missing' }[] = [];
                    for (const q of t.qNums) {
                      const isWrong = wrongSet.has(q);
                      const isMissed = missingSet.has(q);
                      if (isWrong) {
                        wrongItems.push({
                          q,
                          status: 'wrong',
                        });
                      } else if (isMissed) {
                        wrongItems.push({
                          q,
                          status: 'missing',
                        });
                      }
                    }

                    const wrongCount = wrongItems.filter(x => x.status === 'wrong').length;
                    const missingCount = wrongItems.filter(x => x.status === 'missing').length;
                    const lost = wrongCount + missingCount;

                    if (lost > 0) {
                      const correct = Math.max(0, t.count - lost);
                      const pct = Math.round((correct / t.count) * 100);
                      let priority: 'high' | 'medium' | 'low' = 'low';
                      if (pct < 50) priority = 'high';
                      else if (pct < 75) priority = 'medium';

                      let advice = 'Xem lại lý thuyết và làm thêm bài tập dạng này.';
                      if (pt.code === 'TV') {
                        advice = 'Đọc kỹ ngữ liệu văn bản, nắm chắc đặc trưng thể loại và biện pháp tu từ trong chuyên đề.';
                      } else if (pt.code === 'TA') {
                        advice = 'Củng cố cấu trúc ngữ pháp, lưu ý dấu hiệu nhận biết từ loại và mở rộng vốn từ vựng học thuật.';
                      } else if (pt.code === 'TO') {
                        advice = 'Rà soát lại công thức toán học, các bước biến đổi trung gian và tránh các bẫy điều kiện xác định.';
                      } else if (pt.code === 'TDKH') {
                        advice = 'Luyện tập kỹ năng đọc bảng số liệu, biểu đồ và suy luận logic đa nhóm từng bước chặt chẽ.';
                      }

                      weakTopicsList.push({
                        subjectCode: pt.code,
                        subjectName: pt.name,
                        groupName: gn.domain,
                        topicName: t.name,
                        total: t.count,
                        correct,
                        wrong: wrongCount,
                        missing: missingCount,
                        pct,
                        wrongQNums: wrongItems.sort((a, b) => a.q - b.q),
                        priority,
                        advice,
                      });
                    }
                  }
                }
              }

              // Sort weak topics: high priority first, then medium, then by pct
              const prioWeight = { high: 0, medium: 1, low: 2 };
              weakTopicsList.sort((a, b) => {
                if (prioWeight[a.priority] !== prioWeight[b.priority]) {
                  return prioWeight[a.priority] - prioWeight[b.priority];
                }
                return a.pct - b.pct;
              });

              // Compute overall accuracy stats
              const totalQ = activePhanThis.reduce((s, pt) => s + pt.total, 0);
              const totalWrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
              const totalMissing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
              const totalCorrect = Math.max(0, totalQ - totalWrong - totalMissing);
              const totalPct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

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
                <div className="flex flex-col gap-6 w-full min-w-0">

                  {/* SECTION 0: BẢNG TRẠNG THÁI ĐẦY ĐỦ 120 CÂU */}
                  {(() => {
                    const maDe = selectedStudent.maDe || null;
                    const statusByQ = new Map<number, string>();
                    for (const r of selectedStudent.responses || []) statusByQ.set(r.question_num, r.status);

                    const allRows = Array.from({ length: totalQ }, (_, i) => i + 1).map(q => {
                      const info = getQuestionKnowledgeInfo(q);
                      const status = statusByQ.get(q) ?? 'missing';
                      return {
                        q,
                        qInMaDe: getExamCodeQuestionNum(q, maDe),
                        subjectCode: info.subjectCode,
                        subjectName: info.subjectName,
                        groupName: info.groupName,
                        topicName: info.topicName,
                        status,
                      };
                    });

                    const statusOf = (s: string) => (s === 'correct' ? 'correct' : s === 'wrong' ? 'wrong' : 'missing') as 'correct' | 'wrong' | 'missing';
                    const countBy = (s: 'correct' | 'wrong' | 'missing') =>
                      allRows.filter(r => statusOf(r.status) === s).length;

                    const rows = allRows.filter(r => {
                      if (questionSubjectFilter !== 'all' && r.subjectCode !== questionSubjectFilter) return false;
                      if (questionStatusFilter !== 'all' && statusOf(r.status) !== questionStatusFilter) return false;
                      return true;
                    });

                    const statusStyle: Record<'correct' | 'wrong' | 'missing', { chip: string; dot: string; label: string }> = {
                      correct: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500', label: 'Đúng' },
                      wrong: { chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800', dot: 'bg-rose-500', label: 'Sai' },
                      missing: { chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500', label: 'Bỏ trống' },
                    };

                    const filterBtn = (active: boolean) =>
                      `px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`;

                    return (
                      <div className="card p-5 sm:p-6 shadow-md border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <Table className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                                Bảng Trạng Thái Toàn Bộ Đề Thi
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Đủ {allRows.length} câu theo đề gốc
                                {maDe ? ` · Mã đề ${maDe}` : ' · Không có mã đề'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {([
                              ['correct', `Đúng ${countBy('correct')}`],
                              ['wrong', `Sai ${countBy('wrong')}`],
                              ['missing', `Bỏ trống ${countBy('missing')}`],
                            ] as const).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setQuestionStatusFilter(cur => (cur === key ? 'all' : key))}
                                className={`btn btn-sm ${questionStatusFilter === key ? 'btn-primary' : 'btn-ghost'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mb-4">
                          <span className="text-[10px] font-semibold text-slate-400 mr-1">Môn:</span>
                          {([
                            ['all', `Tất cả (${allRows.length})`],
                            ['TV', 'Tiếng Việt'],
                            ['TA', 'Tiếng Anh'],
                            ['TO', 'Toán'],
                            ['TDKH', 'Tư duy KH'],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setQuestionSubjectFilter(key)}
                              className={`btn btn-sm ${questionSubjectFilter === key ? 'btn-primary' : 'btn-ghost'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                          <table className="w-full text-[10px] text-left border-collapse min-w-[560px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-16">Câu</th>
                                <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-24">
                                  Mã đề {maDe || '—'}
                                </th>
                                <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">Phần thi</th>
                                <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">Chuyên đề</th>
                                <th className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-28">Kết quả</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400 font-medium">
                                    Không có câu nào khớp bộ lọc.
                                  </td>
                                </tr>
                              ) : (
                                rows.map(r => {
                                  const st = statusStyle[statusOf(r.status)];
                                  return (
                                    <tr key={r.q} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                      <td className="px-2 py-1.5 text-center font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                                        {r.q}
                                      </td>
                                      <td className="px-2 py-1.5 text-center text-slate-500 dark:text-slate-400 tabular-nums">
                                        {r.qInMaDe}
                                      </td>
                                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                                        <span className="px-1 py-0.5 rounded text-[9px] bg-slate-800 text-white font-black mr-1">
                                          {r.subjectCode}
                                        </span>
                                        {r.subjectName}
                                      </td>
                                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                                        <span className="text-slate-400">{r.groupName} · </span>
                                        {r.topicName}
                                      </td>
                                      <td className="px-2 py-1.5 text-center">
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-bold ${st.chip}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                          {st.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <p className="text-[11.5px] text-slate-400 mt-3">
                          Cột <strong>Câu</strong> là số thứ tự trong đề gốc; cột <strong>Mã đề</strong> là vị trí tương ứng trong mã đề thí sinh làm bài — hai danh sách này được hoán vị khác nhau.
                        </p>
                      </div>
                    );
                  })()}
                  
                  {/* SECTION 1: KIẾN THỨC CẦN ÔN LẠI (THEO SHEET MA TRẬN) */}
                  <div className="card p-5 sm:p-6 shadow-md border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                            Kiến Thức Cần Ôn Lại (Theo Ma Trận Đề Thi)
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Phát hiện tự động các chuyên đề bị mất điểm và đề xuất lộ trình củng cố
                          </p>
                        </div>
                      </div>

                      {/* Summary pill */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {weakTopicsList.length > 0 ? (
                          <>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {weakTopicsList.filter(w => w.priority === 'high').length} chuyên đề cần ôn gấp
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {weakTopicsList.length} chuyên đề có lỗi sai
                            </span>
                          </>
                        ) : (
                          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                            🎉 Đã nắm vững 100% chuyên đề
                          </span>
                        )}
                      </div>
                    </div>

                    {weakTopicsList.length === 0 ? (
                      <div className="p-6 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80">
                        Tuyệt vời! Bạn không sai câu nào hoặc đã hoàn thành xuất sắc toàn bộ ma trận kiến thức!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {weakTopicsList.map((wt, i) => {
                          const isHigh = wt.priority === 'high';
                          const isMed = wt.priority === 'medium';
                          return (
                            <div 
                              key={i}
                              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                                isHigh 
                                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 hover:border-rose-300' 
                                  : isMed
                                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-300'
                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[10.5px] font-black uppercase tracking-wider bg-slate-800 text-white dark:bg-slate-700">
                                      {wt.subjectCode}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                      {wt.groupName}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-black ${
                                    isHigh 
                                      ? 'bg-rose-600 text-white' 
                                      : isMed 
                                        ? 'bg-amber-500 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                  }`}>
                                    {isHigh ? 'Ưu tiên cao' : isMed ? 'Cần củng cố' : 'Xem lại câu sai'}
                                  </span>
                                </div>

                                <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                                  {wt.topicName}
                                </h4>

                                <div className="flex items-center justify-between text-xs mt-1">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Đúng: <strong className="text-emerald-600 dark:text-emerald-400">{wt.correct}/{wt.total} câu</strong>
                                    {wt.wrong > 0 && <span className="text-rose-500 ml-1.5">({wt.wrong} sai)</span>}
                                    {wt.missing > 0 && <span className="text-amber-500 ml-1">({wt.missing} bỏ trống)</span>}
                                  </span>
                                  <span className={`font-black tabular-nums ${getPctColor(wt.pct)}`}>
                                    {wt.pct}%
                                  </span>
                                </div>

                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                                  <div className={`h-full ${getBarGradient(wt.pct)}`} style={{ width: `${wt.pct}%` }} />
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-semibold text-slate-400">Các câu cần xem:</span>
                                  {wt.wrongQNums.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 ${
                                        item.status === 'wrong'
                                          ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300'
                                          : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                                      }`}
                                      title={`Câu ${item.q} (${item.status === 'wrong' ? 'Sai' : 'Bỏ trống'})`}
                                    >
                                      <span>Câu {item.q}</span>
                                      <span className="text-[9.5px] opacity-75">({item.status === 'wrong' ? 'Sai' : 'Bỏ trống'})</span>
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[11.5px] text-slate-600 dark:text-slate-300 italic bg-white/70 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                                  💡 {wt.advice}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: KẾT QUẢ THEO NHÓM KIẾN THỨC (PHẦN THI -> GOM NHÓM -> CHUYÊN ĐỀ) */}
                  <div className="card overflow-hidden w-full min-w-0 shadow-lg border border-slate-200/80 dark:border-slate-800">
                    {/* Header Bar */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col gap-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-500 shrink-0" />
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                              Kết Quả Chi Tiết Theo Nhóm Kiến Thức
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Hiển thị phân cấp 3 cấp: Phần thi (4 môn) → Gom nhóm vùng kiến thức → Chuyên đề chi tiết
                          </p>
                        </div>

                        {/* Overall Badge */}
                        <div className="flex items-center flex-wrap gap-2 text-xs font-bold">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {totalCorrect} Đúng ({totalPct}%)
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> {totalWrong} Sai
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 flex items-center gap-1">
                            - {totalMissing} Bỏ trống
                          </span>
                        </div>
                      </div>

                      {/* Filter & View Mode Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {/* Filter pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
                          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 mr-1">
                            <Filter className="w-3.5 h-3.5" /> Lọc:
                          </span>
                          <button
                            type="button"
                            onClick={() => setKnowledgeFilter('all')}
                            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                          >
                            Tất cả 4 phần thi
                          </button>
                          <button
                            type="button"
                            onClick={() => setKnowledgeFilter('strong')}
                            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'strong' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                          >
                            Tốt (≥80%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setKnowledgeFilter('medium')}
                            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'medium' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                          >
                            Khá (50-79%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setKnowledgeFilter('weak')}
                            className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${knowledgeFilter === 'weak' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                          >
                            Yếu (&lt;50%)
                          </button>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-xs">
                          <button
                            type="button"
                            onClick={() => setKnowledgeViewMode('cards')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${knowledgeViewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                          >
                            <LayoutGrid className="w-3.5 h-3.5" /> Dạng Nhóm
                          </button>
                          <button
                            type="button"
                            onClick={() => setKnowledgeViewMode('table')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${knowledgeViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                          >
                            <Table className="w-3.5 h-3.5" /> Dạng Bảng Ma Trận
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col gap-6">
                      {knowledgeViewMode === 'cards' ? (
                        /* 4 PHẦN THI HIERARCHICAL CARDS */
                        activePhanThis.map((pt) => {
                          const ptWrong = pt.qNums.filter(q => wrongSet.has(q)).length;
                          const ptMissing = pt.qNums.filter(q => missingSet.has(q)).length;
                          const ptCorrect = Math.max(0, pt.total - ptWrong - ptMissing);
                          const ptPct = pt.total > 0 ? Math.round((ptCorrect / pt.total) * 100) : 0;

                          // Filter condition
                          if (knowledgeFilter === 'strong' && ptPct < 80) return null;
                          if (knowledgeFilter === 'medium' && (ptPct < 50 || ptPct >= 80)) return null;
                          if (knowledgeFilter === 'weak' && ptPct >= 50) return null;

                          return (
                            <div 
                              key={pt.code}
                              className={`rounded-2xl border p-4 sm:p-5 bg-white dark:bg-slate-800/90 shadow-sm flex flex-col gap-4 ${pt.borderColor || 'border-slate-200'}`}
                            >
                              {/* Phần thi Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${pt.badgeBg || 'bg-indigo-100 text-indigo-800'}`}>
                                    {pt.code}
                                  </span>
                                  <div>
                                    <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                                      Phần thi {pt.name}
                                    </h4>
                                    <p className="text-xs text-slate-400">
                                      Tổng {pt.total} câu ({pt.qNums[0]} - {pt.qNums[pt.qNums.length - 1]})
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 self-end sm:self-center">
                                  <div className="text-right">
                                    <span className={`text-base sm:text-lg font-black tabular-nums ${getPctColor(ptPct)}`}>
                                      {ptCorrect}/{pt.total} đúng
                                    </span>
                                    <p className="text-[11px] font-bold text-slate-400">Độ chính xác: {ptPct}%</p>
                                  </div>
                                  <div className="w-20 sm:w-28 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                                    <div className={`h-full ${getBarGradient(ptPct)}`} style={{ width: `${ptPct}%` }} />
                                  </div>
                                </div>
                              </div>

                              {/* Gom nhóm Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {pt.gomNhoms.map((gn) => {
                                  const gnWrong = gn.qNums.filter(q => wrongSet.has(q)).length;
                                  const gnMissing = gn.qNums.filter(q => missingSet.has(q)).length;
                                  const gnCorrect = Math.max(0, gn.total - gnWrong - gnMissing);
                                  const gnPct = gn.total > 0 ? Math.round((gnCorrect / gn.total) * 100) : 0;

                                  return (
                                    <div
                                      key={gn.domain}
                                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col justify-between gap-3"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <h5 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
                                            {gn.domain}
                                          </h5>
                                          <span className={`text-xs font-black tabular-nums shrink-0 ${getPctColor(gnPct)}`}>
                                            {gnCorrect}/{gn.total} ({gnPct}%)
                                          </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                                          <div className={`h-full ${getBarGradient(gnPct)}`} style={{ width: `${gnPct}%` }} />
                                        </div>

                                        {/* Chuyên đề con */}
                                        <div className="flex flex-col gap-2 pt-1">
                                          {gn.topics.map((t) => {
                                            const tWrong = t.qNums.filter(q => wrongSet.has(q)).length;
                                            const tMissing = t.qNums.filter(q => missingSet.has(q)).length;
                                            const tCorrect = Math.max(0, t.count - tWrong - tMissing);
                                            const tPct = t.count > 0 ? Math.round((tCorrect / t.count) * 100) : 0;

                                            return (
                                              <div 
                                                key={t.name}
                                                className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-xs flex flex-col gap-1.5"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{t.name}</span>
                                                  <span className={`font-bold tabular-nums shrink-0 text-[11px] ${getPctColor(tPct)}`}>
                                                    {tCorrect}/{t.count} ({tPct}%)
                                                  </span>
                                                </div>

                                                {/* Question Badges */}
                                                <div className="flex items-center flex-wrap gap-1">
                                                  {t.qNums.map(q => {
                                                    const isWrong = wrongSet.has(q);
                                                    const isMissed = missingSet.has(q);

                                                    let badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200';
                                                    let symbol = '✓';
                                                    if (isWrong) {
                                                      badgeStyle = 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 font-bold';
                                                      symbol = '✗';
                                                    } else if (isMissed) {
                                                      badgeStyle = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 font-bold';
                                                      symbol = '-';
                                                    }

                                                    return (
                                                      <span
                                                        key={q}
                                                        className={`px-1.5 py-0.5 rounded text-[10px] border flex items-center gap-1 ${badgeStyle}`}
                                                        title={`Câu ${q} - ${isWrong ? 'Sai' : isMissed ? 'Bỏ trống' : 'Đúng'}`}
                                                      >
                                                        <span>C.{q}</span>
                                                        <span className="text-[9px] opacity-75">{symbol}</span>
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        /* TABLE VIEW */
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700">Phần thi / Nhóm</th>
                                <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">Chuyên đề ma trận</th>
                                <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center">Số câu</th>
                                <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-emerald-600">Đúng</th>
                                <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-rose-500">Sai</th>
                                <th className="px-2.5 py-3 border-b border-slate-200 dark:border-slate-700 text-center text-amber-600">Bỏ trống</th>
                                <th className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 w-32">Tỷ lệ đúng</th>
                                <th className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-700">Các câu hỏi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {activePhanThis.flatMap(pt => 
                                pt.gomNhoms.flatMap(gn => 
                                  gn.topics.map((t, idx) => {
                                    const tWrong = t.qNums.filter(q => wrongSet.has(q)).length;
                                    const tMissing = t.qNums.filter(q => missingSet.has(q)).length;
                                    const tCorrect = Math.max(0, t.count - tWrong - tMissing);
                                    const tPct = t.count > 0 ? Math.round((tCorrect / t.count) * 100) : 0;

                                    return (
                                      <tr key={`${pt.code}-${gn.domain}-${t.name}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                        <td className="px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-white font-black mr-1.5">{pt.code}</span>
                                          <span className="text-slate-600 dark:text-slate-300">{gn.domain}</span>
                                        </td>
                                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">{t.name}</td>
                                        <td className="px-2.5 py-2.5 text-center font-semibold">{t.count}</td>
                                        <td className="px-2.5 py-2.5 text-center font-bold text-emerald-600">{tCorrect}</td>
                                        <td className="px-2.5 py-2.5 text-center font-bold text-rose-500">{tWrong}</td>
                                        <td className="px-2.5 py-2.5 text-center font-bold text-amber-600">{tMissing}</td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                              <div className={`h-full ${getBarGradient(tPct)}`} style={{ width: `${tPct}%` }} />
                                            </div>
                                            <span className={`font-bold tabular-nums text-[11px] ${getPctColor(tPct)}`}>{tPct}%</span>
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
                                                <span
                                                  key={q}
                                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${style}`}
                                                  title={`Câu ${q} - ${isWrong ? 'Sai' : isMissed ? 'Bỏ trống' : 'Đúng'}`}
                                                >
                                                  C.{q} {sym}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>



                </div>
              );
            })()}
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
                    {visibleParts?.tv !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={2}>Tiếng Việt</th>}
                    {visibleParts?.ta !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={2}>Tiếng Anh</th>}
                    {visibleParts?.toan !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={2}>Toán</th>}
                    {visibleParts?.tdkh !== false && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center" colSpan={2}>TDKH</th>}
                    <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center bg-indigo-50/50 dark:bg-indigo-950/30" rowSpan={2}>Tổng<br/>Điểm Neo Đề</th>
                  </tr>
                  <tr>
                    {visibleParts?.tv !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Câu đúng</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th></>}
                    {visibleParts?.ta !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Câu đúng</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th></>}
                    {visibleParts?.toan !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Câu đúng</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th></>}
                    {visibleParts?.tdkh !== false && <><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">Câu đúng</th><th className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center text-[11px]">IRT</th></>}
                  </tr>
                </thead>
                <tbody>
                  {studentHistory.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-bold text-slate-800 dark:text-slate-100">Lần {i + 1}</td>
                      {visibleParts?.tv !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.tv ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.tv ?? '-'}</td></>}
                      {visibleParts?.ta !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.ta ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.ta ?? '-'}</td></>}
                      {visibleParts?.toan !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.toan ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.toan ?? '-'}</td></>}
                      {visibleParts?.tdkh !== false && <><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.tho.tdkh ?? '-'}</td><td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">{s.irt.tdkh ?? '-'}</td></>}
                      <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20">
                        {((visibleParts?.tv !== false ? (s.irt.tv || 0) : 0) + (visibleParts?.ta !== false ? (s.irt.ta || 0) : 0) + (visibleParts?.toan !== false ? (s.irt.toan || 0) : 0) + (visibleParts?.tdkh !== false ? (s.irt.tdkh || 0) : 0)).toFixed(0)}
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
              <AbilityDistribution students={students} metric={classMetric} onMetricChange={setClassMetric} />
            </Suspense>
            <Suspense fallback={<LazyFallback />}>
              <ClassAnalytics
                students={students}
                questions={questions}
                metric={classMetric}
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

      {/* Feedback & Support Section */}
      <div className="mt-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/90 dark:border-slate-700/80 shadow-md flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Góp ý &amp; Giải đáp</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Nếu có bất kỳ thắc mắc hoặc góp ý nào về kết quả thi, hãy liên hệ với ban hỗ trợ qua Discord:
            </p>
          </div>
        </div>

        {/* Supporter Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {[
            { name: 'Haruki', username: 'basten_8386', id: '1244623512958795879' },
            { name: 'nicotine', username: 'warlock2712_', id: '1402670067132665886' },
            { name: 'nmk', username: 'ongcocchumsever', id: '998823224269877268' },
            { name: 'duc', username: 'akona_e', id: '734403880208564235' },
          ].map(s => (
            <a
              key={s.id}
              href={`https://discord.com/users/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <svg className="w-4.5 h-4.5 fill-[#5865F2]" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    @{s.username}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-md shrink-0 ml-1">
                Nhắn tin
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
