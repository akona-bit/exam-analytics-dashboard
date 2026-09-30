import React, { useMemo, useState } from 'react';
import { MetricKey, QuestionData, StudentData } from './types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, UserCircle2, AlertCircle, BookOpen, FileSpreadsheet, Users, Award, Repeat } from 'lucide-react';
import { KnowledgeMatrix } from './KnowledgeMatrix';
import { AbilityDistribution } from './AbilityDistribution';
import { ClassAnalytics } from './ClassAnalytics';
import { CelebrationOverlay } from './CelebrationOverlay';
import { latestAttempts, mean, subjectScore } from './analytics';
import questionTexts from './question_texts.json';

type QuestionTextsType = { [key: string]: string };
const texts = questionTexts as QuestionTextsType;

interface Props { questions: QuestionData[]; students: StudentData[]; }

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

export function Dashboard({ questions, students }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [viewQuestionKey, setViewQuestionKey] = useState<string | null>(null);
  const [progressMetric, setProgressMetric] = useState<'tho' | 'irt' | 'tp'>('tho');
  const [progressSubject, setProgressSubject] = useState<'Toán' | 'TDKH'>('Toán');
  const [showCelebration, setShowCelebration] = useState(false);
  const [landingView, setLandingView] = useState<'lookup' | 'analytics'>('lookup');
  const [classMetric, setClassMetric] = useState<MetricKey>('tho');
  const celebratedRef = React.useRef<Set<string>>(new Set());

  const summaryStats = useMemo(() => {
    if (!students || students.length === 0) return { totalStudents: 0, avgAttempts: 0, avgScore: 0 };
    
    const uniqueStudents = new Set(students.map(s => s.email || s.name));
    const totalStudents = uniqueStudents.size;
    const avgAttempts = (students.length / totalStudents).toFixed(1);
    
    const totalScoreAll = students.reduce((sum, s) => sum + (s.thuongPhat.toan || 0) + (s.thuongPhat.tdkh || 0), 0);
    const avgScore = (totalScoreAll / students.length).toFixed(2);

    return { totalStudents, avgAttempts, avgScore };
  }, [students]);

  const heroStats = useMemo(() => {
    const uniq = latestAttempts(students);
    const toan = uniq.map(s => subjectScore(s, classMetric, 'toan')).filter((v): v is number => v !== null);
    const tdkh = uniq.map(s => subjectScore(s, classMetric, 'tdkh')).filter((v): v is number => v !== null);
    return {
      total: uniq.length,
      avgToan: mean(toan),
      avgTdkh: mean(tdkh),
      avgAttempts: uniq.length ? (students.length / uniq.length).toFixed(1) : '0',
    };
  }, [students, classMetric]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    const matches = students.filter(s => s.name.toLowerCase().includes(lower) || (s.email && s.email.toLowerCase().includes(lower)));
    
    // Group by email/name and pick the latest attempt
    const latestMap = new Map<string, StudentData>();
    for (const m of matches) {
      const key = m.email || m.name;
      const ex = latestMap.get(key);
      if (!ex || m.stt > ex.stt) {
        latestMap.set(key, m);
      }
    }
    
    return Array.from(latestMap.values()).slice(0, 5);
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
    const heroChips = [
      { label: 'Tổng thí sinh', value: String(heroStats.total), note: 'lần thi mới nhất' },
      { label: 'Điểm TB Toán', value: heroStats.avgToan.toFixed(2), note: 'trên thang 25' },
      { label: 'Điểm TB TDKH', value: heroStats.avgTdkh.toFixed(2), note: 'trên thang 25' },
      { label: 'Số lần thi TB', value: heroStats.avgAttempts, note: 'lần / thí sinh' },
    ];

    return (
      <div className="flex flex-col gap-6 sm:gap-8 fade-in">
        <nav className="flex justify-center">
          <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => setLandingView('lookup')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${landingView === 'lookup' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Search className="w-4 h-4" />
              Tra Cứu Điểm
            </button>
            <button
              onClick={() => setLandingView('analytics')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${landingView === 'analytics' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChartIcon className="w-4 h-4" />
              Thống Kê & Phân Tích
            </button>
          </div>
        </nav>

        {landingView === 'analytics' ? (
          <div className="flex flex-col gap-8 sm:gap-10">
            <AbilityDistribution students={students} metric={classMetric} onMetricChange={setClassMetric} />
            <ClassAnalytics
              students={students}
              questions={questions}
              metric={classMetric}
              onSelectStudent={s => setSelectedStudent(s)}
            />
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-sky-500 text-white px-5 sm:px-8 pt-8 sm:pt-10 pb-20 sm:pb-24 shadow-xl shadow-indigo-500/20 mx-auto w-full max-w-5xl">
              <div className="absolute -top-24 -right-16 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-32 -left-12 w-80 h-80 bg-sky-300/25 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center shadow-sm">
                  <UserCircle2 className="w-7 h-7" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Tra Cứu Điểm Thi</h1>
                <p className="text-indigo-100 text-sm sm:text-base">Nhập họ tên của bạn để xem kết quả chi tiết</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl mt-3">
                  {heroChips.map(chip => (
                    <div key={chip.label} className="bg-white/12 border border-white/20 backdrop-blur-sm rounded-2xl px-3 py-2.5 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-100 mb-0.5">{chip.label}</p>
                      <p className="text-xl font-extrabold leading-none">{chip.value}</p>
                      <p className="text-[10px] text-indigo-100/80 mt-1">{chip.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative z-40 -mt-14 sm:-mt-16 w-full max-w-2xl mx-auto px-1">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Ví dụ: Nguyễn Văn A" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium text-lg transition-all shadow-lg shadow-slate-900/10 bg-white"
                />
              </div>

              {searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {searchResults.length > 0 ? (
                    <ul className="py-2">
                      {searchResults.map((s, idx) => (
                        <li 
                          key={idx} 
                          onClick={() => {
                            setSelectedStudent(s);
                            setSearchQuery('');
                          }}
                          className="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-700">{s.name}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-6 text-center text-slate-500">
                      Không tìm thấy thí sinh nào phù hợp.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setLandingView('analytics')}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full transition-colors shadow-sm"
              >
                <BarChartIcon className="w-4 h-4" />
                Xem thống kê & phân tích toàn khóa
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 pb-8 fade-in max-w-5xl mx-auto">
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
                {texts[viewQuestionKey] || "Chưa có dữ liệu nội dung câu hỏi."}
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
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-600 flex items-center justify-center font-bold text-2xl sm:text-3xl shrink-0 shadow-sm border border-white">
            {selectedStudent.name.charAt(0)}
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
        
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-500" />
              Chi tiết các câu sai và bỏ trống
            </h3>
            <p className="text-xs text-slate-500 mt-1">Bảng thông số và nội dung các câu hỏi cần ôn tập lại</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[700px]">
              <thead className="text-xs text-slate-500 bg-slate-100/50 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Câu Hỏi / Nội dung</th>
                  <th className="px-4 py-3 border-b border-slate-200 w-24">Trạng thái</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-24">TS đúng</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-24 text-rose-500">TS sai</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right w-24 text-amber-600">Phạt</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudent.responses?.filter(r => r.status === 'wrong' || r.status === 'missing').sort((a,b) => a.question_num - b.question_num).map((r, i) => {
                  const qKey = `Câu ${r.question_num}`;
                  const qData = questions.find(q => q.id === qKey);
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setViewQuestionKey(qKey)}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 mb-1">{qKey} <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-200/50 px-1.5 py-0.5 rounded">{qData?.subject || ''}</span></div>
                        <div className="text-slate-600 text-xs line-clamp-2">{texts[qKey] || "Chưa có dữ liệu nội dung câu hỏi."}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[11px] font-bold ${r.status === 'wrong' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                          {r.status === 'wrong' ? 'Làm Sai' : 'Bỏ Trống'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{qData?.correct ?? '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-500 font-bold">{qData?.incorrect ?? '-'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-semibold bg-amber-50/10">
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
              <KnowledgeMatrix 
                wrongQuestions={selectedStudent.responses?.filter(r => r.status === 'wrong').map(r => r.question_num) || []} 
                missingQuestions={selectedStudent.responses?.filter(r => r.status === 'missing').map(r => r.question_num) || []} 
              />
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

      {/* Class Statistics */}
      <div className="mt-8 flex flex-col gap-4 sm:gap-5 md:gap-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 border-b border-slate-200 pb-2">Thống Kê Chung Toàn Lớp</h2>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-0.5">Số lượng thí sinh</p>
              <p className="text-2xl font-black text-slate-800">{summaryStats.totalStudents}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-0.5">Điểm TB toàn khóa</p>
              <p className="text-2xl font-black text-slate-800">{summaryStats.avgScore}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-0.5">Số lần thi trung bình</p>
              <p className="text-2xl font-black text-slate-800">{summaryStats.avgAttempts} <span className="text-sm font-medium text-slate-500">lần/HS</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
