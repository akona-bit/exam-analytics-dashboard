import React, { Suspense, lazy, useMemo, useState, useRef } from 'react';
import { MetricKey, QuestionData, StudentData } from '../../types';
import { EXAM_LABEL, QUESTIONS_TOTAL, sortedScores, quantile } from '../../lib/analytics';
import { Area, AreaChart, CartesianGrid, Legend, Line, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Search, BarChart as BarChartIcon, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen,
  Target, PieChart as PieChartIcon, HelpCircle, MailOpen, ArrowRight, Sparkles, LifeBuoy,
  Lock, Eye, EyeOff, User,
} from 'lucide-react';

import { CelebrationOverlay } from './CelebrationOverlay';
import { ThankYouModal } from './ThankYouModal';
import { QuestionStatsTable } from './QuestionStatsTable';
import { QuestionMap } from './QuestionMap';
import { KnowledgeBreakdown } from './KnowledgeBreakdown';
import { parseKnowledgeCSV, DEFAULT_KNOWLEDGE_CSV, getTopicPerformance } from '../../lib/knowledgeStructure';

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
    <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
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
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [classMetric, setClassMetric] = useState<MetricKey>('irt');
  const [studentTab, setStudentTab] = useState<'overview' | 'review' | 'history' | 'class'>('overview');
  const [reviewView, setReviewView] = useState<'questions' | 'topics'>('questions');
  /**
   * Thang điểm của radar "So với lớp". Mặc định IRT: nhiều thí sinh bỏ trống
   * phần thi nên điểm thô (0–30) tạo ra 2 trục gần 0 → chói và khó đọc.
   */
  const [subjectMetric, setSubjectMetric] = useState<MetricKey>('irt');

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
    if (!selectedStudent) return;
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedStudent]);

  const handleCloseThankYou = () => {
    setShowThankYouModal(false);
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
    if (!selectedStudent || total <= 0) return { correct: 0, total: 0, wrong: 0, missing: 0 };
    const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
    const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
    return { correct: Math.max(0, total - wrong - missing), total, wrong, missing };
  }, [selectedStudent, maxExamQuestionNum]);

  /** Các chuyên đề nổi bật / cần ôn, dùng cho khối tóm tắt ở tab Tổng quan. */
  const topicInsights = useMemo(() => {
    if (!selectedStudent) return { strongest: [], weakest: [] };
    const rows = getTopicPerformance(knowledgeStructure, selectedStudent.responses).filter(t => t.total > 0);

    // Chọn một chuyên đề đại diện cho mỗi phần thi, sau đó xếp hạng các phần thi
    // theo tỷ lệ đúng. Cách này tránh việc cả 3 dòng "mạnh/yếu" đều thuộc cùng
    // một môn chỉ vì các chuyên đề trong môn đó đồng điểm.
    const bySubject = new Map<string, typeof rows>();
    for (const row of rows) {
      const current = bySubject.get(row.code);
      if (current) current.push(row);
      else bySubject.set(row.code, [row]);
    }

    const subjectStats = Array.from(bySubject.entries()).map(([code, items]) => {
      const total = items.reduce((sum, item) => sum + item.total, 0);
      const correct = items.reduce((sum, item) => sum + item.correct, 0);
      const sortedItems = [...items].sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
      return {
        code,
        pct: total > 0 ? Math.round((correct / total) * 100) : 0,
        weakest: sortedItems[0],
        strongest: sortedItems[sortedItems.length - 1],
      };
    });

    return {
      weakest: [...subjectStats].sort((a, b) => a.pct - b.pct).slice(0, 3).map(item => item.weakest),
      strongest: [...subjectStats].sort((a, b) => b.pct - a.pct).slice(0, 3).map(item => item.strongest),
    };
  }, [knowledgeStructure, selectedStudent]);

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
    // Radar luôn dùng thang điểm neo đề (IRT /300) để so với trung vị lớp.
    const metric: MetricKey = 'irt';
    /**
     * Mốc so sánh là TRUNG VỊ của lớp, không phải trung bình cộng: một vài điểm
     * quá cao/thấp không còn kéo lệch "mức điển hình" của cả lớp.
     * `sortedScores` đã bỏ giá trị null và sắp xếp tăng dần.
     */
    const getMedian = (subj: 'tv' | 'ta' | 'toan' | 'tdkh') =>
      +quantile(sortedScores(students, metric, subj), 0.5).toFixed(2);

    const s = selectedStudent;
    const res: Record<string, string | number>[] = [];
    if (visibleParts?.tv !== false) {
      res.push({ subject: 'Tiếng Việt', key: 'tv', 'Điểm Của Bạn': s[metric].tv || 0, 'Trung Vị': getMedian('tv') });
    }
    if (visibleParts?.ta !== false) {
      res.push({ subject: 'Tiếng Anh', key: 'ta', 'Điểm Của Bạn': s[metric].ta || 0, 'Trung Vị': getMedian('ta') });
    }
    if (visibleParts?.toan !== false) {
      res.push({ subject: 'Toán', key: 'toan', 'Điểm Của Bạn': s[metric].toan || 0, 'Trung Vị': getMedian('toan') });
    }
    if (visibleParts?.tdkh !== false) {
      res.push({ subject: 'Tư duy KH', key: 'tdkh', 'Điểm Của Bạn': s[metric].tdkh || 0, 'Trung Vị': getMedian('tdkh') });
    }
    return res;
  }, [selectedStudent, students, visibleParts, subjectMetric]);

  /** Tooltip không đặt color để nhãn từng series giữ đúng màu tương ứng. */
  const tooltipStyle = {
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '13px',
    backgroundColor: '#ffffff',
  };

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
      <div className="flex flex-col items-center justify-center min-h-[70vh] fade-in relative w-full py-4">
        <div className="relative z-10 w-full flex flex-col items-center px-3">

          {/* Logo + tên kỳ thi, gọn hơn để form là trọng tâm */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm shrink-0">
              <img src="/logo.png" alt="Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Tra cứu kết quả
              </p>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-tight modern-title">
                {examName}
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-5 text-center max-w-md leading-relaxed">
            Nhập họ tên hoặc email, sau đó dùng <strong className="text-slate-700">Số báo danh (SBD)</strong> để mở kết quả của bạn.
          </p>

          <form onSubmit={handleLoginSubmit} className="relative w-full max-w-md px-1">
            <div className="w-full rounded-2xl bg-white p-5 sm:p-6 flex flex-col gap-4 fade-in border border-slate-200 shadow-[0_18px_50px_-18px_rgba(30,40,90,0.35)]">

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* FIELD 1: Name or Email */}
              <div className="flex flex-col gap-1.5 relative w-full">
                <label htmlFor="lookup-name" className="pl-0.5 text-[11px] font-extrabold text-slate-700">
                  Họ tên hoặc email
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 placeholder:text-slate-400 font-semibold text-sm transition-all bg-white outline-none"
                  />
                </div>

                {searchQuery.trim().length >= 2 && autoCompleteSuggestions.length > 0 && (
                  <div className="w-full mt-1 max-h-56 overflow-y-auto overscroll-contain bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                    {autoCompleteSuggestions.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(student.customDisplayName || student.name);
                          setAuthError(null);
                          setTimeout(() => passwordInputRef.current?.focus(), 50);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-xs text-slate-700 truncate">
                            {student.customDisplayName || student.name}
                          </span>
                        </span>
                        <span className="text-[10px] text-indigo-500 font-bold shrink-0">Chọn</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* FIELD 2: Password is SBD */}
              <div className="flex flex-col gap-1.5 relative w-full">
                <label htmlFor="lookup-password" className="pl-0.5 text-[11px] font-extrabold text-slate-700">
                  Số báo danh (SBD)
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
                  <input
                    ref={passwordInputRef}
                    id="lookup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập SBD của bạn"
                    value={passwordSbd}
                    onChange={(e) => {
                      setPasswordSbd(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 placeholder:text-slate-400 font-semibold text-sm transition-all bg-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Ẩn SBD' : 'Hiện SBD'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="pl-0.5 flex items-start gap-1 text-[10.5px] font-semibold text-amber-600">
                  <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>SBD chính là mật khẩu tra cứu đã cấp cho bạn.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="w-full mt-1 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm flex items-center gap-2 justify-center cursor-pointer"
              >
                <Search className="w-4 h-4" />
                Tra cứu kết quả
              </button>
            </div>
          </form>

          <p className="mt-4 text-[10px] text-slate-400 text-center">
            Kết quả chỉ hiển thị cho đúng thí sinh · Email không công khai
          </p>
        </div>
      </div>
    );
  }

  const displayName = selectedStudent.customDisplayName || (selectedStudent.name.match(/^\d+$/) ? `Thí sinh ${selectedStudent.name}` : selectedStudent.name);

  /** Bốn màu định danh môn học, dùng thống nhất cho card, radar và bảng so sánh. */
  const SUBJECT_META: Record<'tv' | 'ta' | 'toan' | 'tdkh', { name: string; code: string; color: string }> = {
    tv: { name: 'Tiếng Việt', code: 'TV', color: '#0f766e' },
    ta: { name: 'Tiếng Anh', code: 'TA', color: '#b45309' },
    toan: { name: 'Toán', code: 'TO', color: '#4338ca' },
    tdkh: { name: 'Tư duy KH', code: 'TDKH', color: '#0369a1' },
  };

  const subjectCards: {
    key: 'tv' | 'ta' | 'toan' | 'tdkh';
    name: string;
    code: string;
    score: number;
    raw: number;
    color: string;
    /** Giá trị trung vị lớp cùng thang điểm, để vẽ chú thích “so với lớp”. */
    median: number;
  }[] = (['tv', 'ta', 'toan', 'tdkh'] as const)
    .map(key => {
      const meta = SUBJECT_META[key];
      const median = quantile(sortedScores(students, 'irt', key), 0.5);
      return {
        key,
        name: meta.name,
        code: meta.code,
        color: meta.color,
        score: selectedStudent.irt[key] ?? 0,
        raw: selectedStudent.tho[key] ?? 0,
        median: Number.isFinite(median) ? +median.toFixed(1) : 0,
      };
    })
    .filter(item => visibleParts?.[item.key] !== false);

  const totalIrt = subjectCards.reduce((sum, item) => sum + item.score, 0);
  const hasNextExamDate = Boolean(nextExamDate && !/chưa có/i.test(nextExamDate));
  const correctPct = correctCount.total > 0 ? Math.round((correctCount.correct / correctCount.total) * 100) : 0;
  const wrongPct = correctCount.total > 0 ? Math.round((correctCount.wrong / correctCount.total) * 100) : 0;
  const missingPct = correctCount.total > 0 ? Math.round((correctCount.missing / correctCount.total) * 100) : 0;

  /** Màu nhận diện môn học cho các badge chuyên đề trong khối tóm tắt. */
  const topicColorByCode: Record<string, string> = {
    TV: SUBJECT_META.tv.color,
    TA: SUBJECT_META.ta.color,
    TO: SUBJECT_META.toan.color,
    TDKH: SUBJECT_META.tdkh.color,
  };

  const tabClass = (active: boolean) =>
    `px-3 sm:px-5 py-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
      active
        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
    }`;

  const openReview = (view: 'questions' | 'topics') => {
    setReviewView(view);
    setStudentTab('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchTab = (tab: 'overview' | 'review' | 'history' | 'class') => {
    setStudentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 pb-8 fade-in max-w-6xl mx-auto w-full min-w-0">
      {studentRankInfo && (
        <CelebrationOverlay
          show={showCelebration}
          rank={studentRankInfo.rankIrt || 1}
          name={selectedStudent.name}
          onComplete={() => setShowCelebration(false)}
        />
      )}
      <ThankYouModal
        show={showThankYouModal}
        studentName={selectedStudent.customDisplayName || selectedStudent.name}
        onClose={handleCloseThankYou}
      />

      {/* Thanh thao tác gọn */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => { setSelectedStudent(null); setStudentTab('overview'); setReviewView('questions'); }}
          className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 bg-white shadow-xs hover:shadow-sm font-bold transition-all px-3 sm:px-4 py-2 rounded-xl border border-slate-200 text-[11px] sm:text-xs cursor-pointer group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Tra cứu khác</span>
        </button>

        <button
          type="button"
          onClick={() => setShowThankYouModal(true)}
          className="flex items-center gap-1.5 text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 font-bold transition-all px-3 sm:px-4 py-2 rounded-xl border border-amber-200 text-[11px] sm:text-xs cursor-pointer group"
          title="Xem lại thư cảm ơn từ Team MIT Hàn Thuyên"
        >
          <MailOpen className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
          <span>Thư cảm ơn</span>
        </button>
      </div>

      {/* Hồ sơ + điểm tổng: một khối duy nhất, thay cho 4 thẻ số liệu rời rạc */}
      <section className="card overflow-hidden">
        {studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1) && (
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-white text-[11px] sm:text-xs font-extrabold tracking-wide">
            <span className="text-base">👑</span>
            <span>Bạn đạt danh hiệu <span className="bg-white/20 px-1.5 py-0.5 rounded uppercase">Thủ khoa</span> kỳ thi này!</span>
          </div>
        )}
        {studentRankInfo && studentRankInfo.rankTho !== 1 && studentRankInfo.rankIrt !== 1 &&
          (studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2) && (
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-gradient-to-r from-slate-300 via-gray-300 to-slate-400 text-slate-800 text-[11px] sm:text-xs font-extrabold tracking-wide">
            <span className="text-base">🥈</span>
            <span>Bạn đạt danh hiệu <span className="bg-slate-900/10 px-1.5 py-0.5 rounded uppercase">Á khoa</span> kỳ thi này!</span>
          </div>
        )}

        <div className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center">
                {studentRankInfo && (studentRankInfo.rankTho === 1 || studentRankInfo.rankIrt === 1) ? (
                  <span className="text-2xl">👑</span>
                ) : studentRankInfo && (studentRankInfo.rankTho === 2 || studentRankInfo.rankIrt === 2) ? (
                  <span className="text-2xl">🥈</span>
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
                      className="w-full h-full items-center justify-center font-black text-base bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                    >
                      {displayName.trim().split(/\s+/).map(n => n[0]).slice(-2).join('').toUpperCase()}
                    </div>
                  </>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate max-w-full">
                    {displayName}
                  </h1>
                  {selectedStudent.sbd && (
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      SBD {selectedStudent.sbd}
                    </span>
                  )}
                  {selectedStudent.maDe && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      Mã đề {selectedStudent.maDe}
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{EXAM_LABEL}</span>
                  <span className="text-slate-300">·</span>
                  <span>{studentHistory.length > 1 ? `${studentHistory.length} lần thi` : 'Lần thi gần nhất'}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 w-full lg:w-auto lg:min-w-[440px]">
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 px-3 py-2.5">
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-indigo-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  Điểm neo đề
                </span>
                <div className="mt-0.5 text-xl sm:text-2xl font-black text-indigo-700 tabular-nums leading-none">
                  {Math.round(totalIrt)}
                  <span className="text-[10px] font-bold text-indigo-400"> /1200</span>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-3 py-2.5">
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Câu đúng
                </span>
                <div className="mt-0.5 text-xl sm:text-2xl font-black text-emerald-700 tabular-nums leading-none">
                  {correctCount.correct}
                  <span className="text-[10px] font-bold text-emerald-400"> /{correctCount.total}</span>
                </div>
                <span className="text-[9px] font-semibold text-emerald-600">{correctPct}% toàn bài</span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-2.5">
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  Hạng IRT
                </span>
                <div className="mt-0.5 text-xl sm:text-2xl font-black text-amber-700 tabular-nums leading-none">
                  #{studentRankInfo?.rankIrt ?? '—'}
                  <span className="text-[10px] font-bold text-amber-400"> /{students.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-semibold text-slate-500 mb-1.5">
              <span>Cơ cấu {correctCount.total} câu</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Đúng {correctCount.correct}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Sai {correctCount.wrong}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Trống {correctCount.missing}</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {correctCount.total > 0 && (
                <>
                  <div className="bg-emerald-500" style={{ width: `${correctPct}%` }} />
                  <div className="bg-rose-500" style={{ width: `${wrongPct}%` }} />
                  <div className="bg-amber-400" style={{ width: `${missingPct}%` }} />
                </>
              )}
            </div>
          </div>
        </div>

        <nav className="flex items-center overflow-x-auto hide-scrollbar border-t border-slate-100 px-1.5 sm:px-3">
          <button onClick={() => switchTab('overview')} className={tabClass(studentTab === 'overview')}>
            <BarChartIcon className="w-3.5 h-3.5" />
            <span>Tổng quan</span>
          </button>
          <button onClick={() => switchTab('review')} className={tabClass(studentTab === 'review')}>
            <Target className="w-3.5 h-3.5" />
            <span>Bài làm &amp; kiến thức</span>
          </button>
          {studentHistory.length > 1 && (
            <button onClick={() => switchTab('history')} className={tabClass(studentTab === 'history')}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Lịch sử {studentHistory.length} lần</span>
            </button>
          )}
          <button onClick={() => switchTab('class')} className={tabClass(studentTab === 'class')}>
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Toàn khóa</span>
          </button>
        </nav>
      </section>

      {/* TAB: TỔNG QUAN */}
      {studentTab === 'overview' && (
        <div className="flex flex-col gap-4 fade-in">
          <section className="card p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="text-sm sm:text-base font-black text-slate-800">Điểm theo từng phần</h2>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Điểm neo đề /300 · số câu đúng /30</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {subjectCards.map(subject => {
                const pctScore = Math.max(0, Math.min(100, Math.round((subject.score / 300) * 100)));
                const pctMedian = Math.max(0, Math.min(100, Math.round((subject.median / 300) * 100)));
                const diff = +(subject.score - subject.median).toFixed(1);
                return (
                  <div
                    key={subject.key}
                    className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5"
                    style={{ borderTop: `3px solid ${subject.color}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
                        {subject.code}
                      </span>
                      <span className="text-[9.5px] font-semibold text-slate-500 tabular-nums">
                        {subject.raw}/30 câu
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-bold text-slate-700 truncate">{subject.name}</h3>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="text-2xl font-black tabular-nums leading-none" style={{ color: subject.color }}>
                        {subject.score}
                      </span>
                      <span className="text-[9.5px] font-semibold text-slate-400">/ 300</span>
                    </div>
                    <div className="mt-2 relative h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pctScore}%`, backgroundColor: subject.color }}
                      />
                      {/* Vạch trung vị lớp trên cùng thanh điểm */}
                      <span
                        className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-slate-700"
                        style={{ left: `calc(${pctMedian}% - 1px)` }}
                        title={`Trung vị lớp: ${subject.median}/300`}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-semibold">
                      <span className="text-slate-500 tabular-nums">Trung vị {subject.median}</span>
                      <span
                        className="tabular-nums font-bold"
                        style={{ color: diff >= 0 ? '#0f766e' : '#b91c1c' }}
                      >
                        {diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-4">
            <section className="card p-4 sm:p-5">
              <div className="pb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <BarChartIcon className="w-4 h-4 text-indigo-500" />
                  Radar Điểm Theo Trung Vị Lớp
                </h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Điểm chuẩn hoá IRT /300 · vòng nét đứt là trung vị lớp
                </p>
              </div>

              <div className="h-[250px] sm:h-[270px] w-full mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarDataCompare}>
                    <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={(tickProps: any) => (
                        <text
                          x={tickProps.x}
                          y={tickProps.y}
                          textAnchor={tickProps.textAnchor}
                          dominantBaseline="central"
                          fill="#334155"
                          fontSize={11}
                          fontWeight={700}
                        >
                          {tickProps.payload.value}
                        </text>
                      )}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toFixed(1)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '2px' }} />
                    <Radar
                      name="Điểm của bạn"
                      dataKey="Điểm Của Bạn"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill="#6366f1"
                      fillOpacity={0.18}
                      dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }}
                    />
                    <Radar
                      name="Trung vị lớp"
                      dataKey="Trung Vị"
                      stroke="#0f766e"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      fill="#14b8a6"
                      fillOpacity={0.1}
                      dot={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-1 border-t border-slate-100 pt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Bạn so với trung vị lớp</span>
                  <span className="text-[10px] font-semibold text-slate-400">IRT /300</span>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="text-left font-bold py-1">Môn</th>
                      <th className="text-right font-bold py-1">Bạn</th>
                      <th className="text-right font-bold py-1">Trung vị</th>
                      <th className="text-right font-bold py-1">Lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {radarDataCompare.map(row => {
                      const you = Number(row['Điểm Của Bạn'] ?? 0);
                      const med = Number(row['Trung Vị'] ?? 0);
                      const diff = +(you - med).toFixed(1);
                      const color = SUBJECT_META[(row.key as 'tv' | 'ta' | 'toan' | 'tdkh') ?? 'tv']?.color ?? '#4f46e5';
                      return (
                        <tr key={String(row.subject)}>
                          <td className="py-1 font-semibold text-slate-700">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {row.subject}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums font-bold" style={{ color }}>{you.toFixed(1)}</td>
                          <td className="py-1 text-right tabular-nums text-slate-600">{med.toFixed(1)}</td>
                          <td
                            className="py-1 text-right tabular-nums font-bold"
                            style={{ color: diff >= 0 ? '#0f766e' : '#b91c1c' }}
                          >
                            {diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : ''}{diff.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card p-4 sm:p-5 flex flex-col">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  Điểm mạnh &amp; cần cải thiện
                </h3>
                <p className="mt-1 text-[10.5px] text-slate-500">
                  Tỷ lệ câu đúng theo từng vùng kiến thức
                </p>
              </div>

              <div className="mt-3 flex flex-1 flex-col gap-2.5">
                {([
                  {
                    key: 'strong',
                    title: 'Nổi bật',
                    icon: Sparkles,
                    topics: topicInsights.strongest,
                    panelClass: 'border-emerald-100 bg-emerald-50/50',
                    headingClass: 'text-emerald-700',
                    countClass: 'border-emerald-100 bg-white/80 text-emerald-700',
                    pctClass: 'text-emerald-600',
                    barClass: 'bg-emerald-500',
                    trackClass: 'bg-emerald-100/80',
                  },
                  {
                    key: 'weak',
                    title: 'Cần cải thiện',
                    icon: Target,
                    topics: topicInsights.weakest,
                    panelClass: 'border-rose-100 bg-rose-50/50',
                    headingClass: 'text-rose-700',
                    countClass: 'border-rose-100 bg-white/80 text-rose-700',
                    pctClass: 'text-rose-600',
                    barClass: 'bg-rose-500',
                    trackClass: 'bg-rose-100/80',
                  },
                ] as const).map(group => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.key}
                      className={`flex flex-1 flex-col rounded-xl border p-3 ${group.panelClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wide ${group.headingClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {group.title}
                        </h4>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${group.countClass}`}>
                          {group.topics.length} vùng
                        </span>
                      </div>

                      {group.topics.length === 0 ? (
                        <p className="flex flex-1 items-center justify-center py-4 text-[11px] text-slate-400">
                          Chưa đủ dữ liệu.
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-1 flex-col justify-evenly gap-2">
                          {group.topics.map(topic => {
                            const color = topicColorByCode[topic.code] || '#64748b';
                            return (
                              <div key={`${group.key}-${topic.code}-${topic.name}`} className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-md text-[8.5px] font-black"
                                    style={{ backgroundColor: `${color}14`, color }}
                                  >
                                    {topic.code}
                                  </span>
                                  <span
                                    className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-700"
                                    title={`${topic.name} · ${topic.correct}/${topic.total} câu đúng`}
                                  >
                                    {topic.name}
                                  </span>
                                  <span className="shrink-0 text-right leading-none">
                                    <span className={`block text-[11.5px] font-black tabular-nums ${group.pctClass}`}>
                                      {topic.pct}%
                                    </span>
                                    <span className="mt-0.5 block text-[8.5px] font-semibold tabular-nums text-slate-400">
                                      {topic.correct}/{topic.total} câu
                                    </span>
                                  </span>
                                </div>
                                <div
                                  className={`ml-9 mt-1.5 h-1.5 overflow-hidden rounded-full ${group.trackClass}`}
                                  role="progressbar"
                                  aria-valuenow={topic.pct}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label={`${topic.name}: ${topic.correct}/${topic.total} câu đúng`}
                                >
                                  <div
                                    className={`h-full rounded-full ${group.barClass}`}
                                    style={{ width: `${topic.pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => openReview('topics')}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Xem phân tích vùng kiến thức
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </section>
          </div>

          <QuestionStatsTable
            questions={questions}
            responses={selectedStudent.responses}
            maDe={selectedStudent.maDe}
          />
        </div>
      )}

      {/* TAB: BÀI LÀM & KIẾN THỨC */}
      {studentTab === 'review' && (
        <div className="flex flex-col gap-4 fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setReviewView('questions')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  reviewView === 'questions' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                120 câu
              </button>
              <button
                type="button"
                onClick={() => setReviewView('topics')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  reviewView === 'topics' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Vùng kiến thức
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              {reviewView === 'questions'
                ? 'Bảng đầy đủ, tự co giãn theo màn hình.'
                : 'Mặc định chỉ hiện các vùng dưới 50%; đổi bộ lọc để xem thêm.'}
            </p>
          </div>

          {reviewView === 'questions' ? (
            <>
              <QuestionMap
                totalQuestions={maxExamQuestionNum}
                responses={selectedStudent.responses}
                maDe={selectedStudent.maDe}
              />
              <QuestionStatsTable
                questions={questions}
                responses={selectedStudent.responses}
                maDe={selectedStudent.maDe}
              />
            </>
          ) : (
            <KnowledgeBreakdown student={selectedStudent} structure={knowledgeStructure} />
          )}
        </div>
      )}

      {/* TAB: LỊCH SỬ */}
      {studentTab === 'history' && studentHistory.length > 1 && (
        <div className="flex flex-col gap-4 fade-in">
          <section className="card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 pb-2.5 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-rose-500" />
                  Tiến bộ qua các lần thi
                </h3>
                <p className="text-[10.5px] text-slate-500 mt-0.5">So sánh điểm của bạn với trung bình lớp</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setProgressSubject('Toán')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${progressSubject === 'Toán' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Toán
                  </button>
                  <button
                    onClick={() => setProgressSubject('TDKH')}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${progressSubject === 'TDKH' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    TDKH
                  </button>
                </div>
                <select
                  className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[10.5px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={progressMetric}
                  onChange={(e) => setProgressMetric(e.target.value as MetricKey)}
                >
                  <option value="tho">Điểm thô</option>
                  <option value="irt">Điểm neo đề</option>
                </select>
              </div>
            </div>
            <div className="h-[220px] sm:h-[250px] w-full -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={progressSubject === 'Toán' ? '#6366f1' : '#0ea5e9'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '6px', fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    name={`Điểm ${progressSubject} (cá nhân)`}
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
                    name={`TB lớp ${progressSubject}`}
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
          </section>

          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Các lần thi
              </h3>
              <span className="text-[10.5px] text-slate-400">{studentHistory.length} lần</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {studentHistory.map((attempt, index) => {
                const attemptTotal = subjectCards.reduce((sum, subject) => sum + (attempt.irt[subject.key] ?? 0), 0);
                return (
                  <div key={index} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">Lần {index + 1}</span>
                      <span className="text-sm font-black text-indigo-600 tabular-nums">
                        {attemptTotal.toFixed(0)}
                        <span className="text-[9.5px] font-bold text-slate-400"> /1200</span>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {subjectCards.map(subject => (
                        <div key={subject.key} className="rounded-lg bg-slate-50 px-2 py-1.5">
                          <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">{subject.name}</span>
                          <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                            {attempt.irt[subject.key] ?? 0}
                            <span className="text-[9px] font-semibold text-slate-400"> IRT</span>
                          </span>
                          <span className="block text-[9px] text-slate-400 tabular-nums">
                            {attempt.tho[subject.key] ?? 0}/30 câu
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB: TOÀN KHÓA */}
      {studentTab === 'class' && (
        <Suspense fallback={<LazyFallback />}>
          <ClassAnalytics
            students={students}
            questions={questions}
            metric={classMetric}
            onMetricChange={setClassMetric}
          />
        </Suspense>
      )}

      {/* Thông tin phụ */}
      {(answerLink || hasNextExamDate) && (
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {hasNextExamDate && (
            <div className="flex items-center gap-2.5 text-slate-700">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Dự kiến đợt thi tiếp theo</p>
                <p className="text-xs sm:text-sm font-bold text-slate-800">{nextExamDate}</p>
              </div>
            </div>
          )}
          {answerLink && (
            <a
              href={answerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto text-center flex items-center justify-center gap-2 text-[11px] sm:text-xs shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              Xem đáp án chi tiết
            </a>
          )}
        </div>
      )}

      {/* Hỗ trợ: mặc định thu gọn để không chiếm màn hình */}
      <details className="card overflow-hidden group">
        <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none hover:bg-slate-50 transition-colors [&::-webkit-details-marker]:hidden">
          <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-800">Cần hỗ trợ?</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">Nhắn qua các Discord</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 ml-auto shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { name: 'Haruki', username: 'basten_8386', id: '1244623512958795879' },
            { name: 'nicotine', username: 'warlock2712_', id: '1402670067132665886' },
            { name: 'nmk', username: 'ongcocchumsever', id: '998823224269877268' },
            { name: 'duc', username: 'akona_e', id: '734403880208564235' },
          ].map(supporter => (
            <a
              key={supporter.id}
              href={`https://discord.com/users/${supporter.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-colors min-w-0"
            >
              <svg className="w-4 h-4 fill-[#5865F2] shrink-0" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span className="min-w-0">
                <span className="block text-[10.5px] font-bold text-slate-700 truncate">{supporter.name}</span>
                <span className="block text-[9px] text-slate-400 truncate">@{supporter.username}</span>
              </span>
            </a>
          ))}
        </div>
      </details>
    </div>
  );
}
