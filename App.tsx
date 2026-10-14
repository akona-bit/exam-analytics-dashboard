import { Moon, Sun } from 'lucide-react';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './Dashboard';
import { AdminPage } from './AdminPage';
import { QuestionData, StudentData } from './types';
import { normalizeExamType } from './analytics';
import defaultQuestionTexts from './question_texts.json';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { DEFAULT_KNOWLEDGE_CSV } from './lib/knowledgeStructure';

/* ──────────── Supabase → App type mapping ──────────── */

interface SupabaseStudent {
  stt: number; name: string; email: string | null;
  tho_toan: number | null; tho_tdkh: number | null; tho_tv: number | null; tho_ta: number | null;
  irt_toan: number | null; irt_tdkh: number | null; irt_tv: number | null; irt_ta: number | null;
  tp_toan: number | null; tp_tdkh: number | null; tp_tv: number | null; tp_ta: number | null;
  note: string | null;
  exam_type?: string | null;
}
interface SupabaseQuestion {
  question_id: string; subject: string;
  total_attempts: number | null; correct: number | null; incorrect: number | null;
  penalty_score: number | null; bonus1: number | null; bonus2: number | null;
  bonus3: number | null; bonus_correct: number | null; is_error: boolean | null;
  exam_type?: string | null;
}
interface SupabaseResponse {
  student_stt: number; student_name: string;
  question_num: number; status: string;
  exam_type?: string | null;
}

/** Fetch all data from Supabase, return null if it fails or is empty */
async function fetchFromSupabase(): Promise<{ questions: QuestionData[]; students: StudentData[] } | null> {
  if (!supabase) return null;

  try {
    const [studentsRes, questionsRes, responsesRes] = await Promise.all([
      supabase.from('students').select('*').order('stt', { ascending: true }),
      supabase.from('questions').select('*'),
      supabase.from('student_responses').select('*'),
    ]);

    // If any error or no students data, fall back
    if (studentsRes.error || questionsRes.error || responsesRes.error) return null;
    if (!studentsRes.data || studentsRes.data.length === 0) return null;

    // Group responses by exam type + student_stt
    const responsesByKey = new Map<string, { question_num: number; status: string }[]>();
    for (const r of (responsesRes.data || []) as SupabaseResponse[]) {
      const key = `${normalizeExamType(r.exam_type)}::${r.student_stt}`;
      if (!responsesByKey.has(key)) responsesByKey.set(key, []);
      responsesByKey.get(key)!.push({ question_num: r.question_num, status: r.status });
    }

    // Map students
    const students: StudentData[] = (studentsRes.data as SupabaseStudent[]).map(s => {
      const examType = normalizeExamType(s.exam_type);
      return {
      stt: s.stt,
      name: s.name,
      email: s.email || undefined,
      examType,
      tho: { toan: s.tho_toan, tdkh: s.tho_tdkh, tv: s.tho_tv ?? null, ta: s.tho_ta ?? null },
      irt: { toan: s.irt_toan, tdkh: s.irt_tdkh, tv: s.irt_tv ?? null, ta: s.irt_ta ?? null },
      thuongPhat: { toan: s.tp_toan, tdkh: s.tp_tdkh, tv: s.tp_tv ?? null, ta: s.tp_ta ?? null },
      note: s.note || undefined,
      responses: responsesByKey.get(`${examType}::${s.stt}`),
      };
    });

    // Map questions
    const questions: QuestionData[] = (questionsRes.data as SupabaseQuestion[]).map(q => ({
      id: q.question_id,
      subject: q.subject,
      examType: normalizeExamType(q.exam_type),
      totalAttempts: q.total_attempts,
      correct: q.correct,
      incorrect: q.incorrect,
      penaltyScore: q.penalty_score,
      bonus1: q.bonus1,
      bonus2: q.bonus2,
      bonus3: q.bonus3,
      bonusCorrect: q.bonus_correct,
      isError: q.is_error ?? undefined,
    }));

    return { questions, students };
  } catch {
    return null;
  }
}

/** Fetch from API or static JSON fallback */
async function fetchFromStatic(): Promise<{ questions: QuestionData[]; students: StudentData[] }> {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

  const fetchJson = async (apiPath: string, staticPath: string) => {
    try {
      const res = await fetch(apiPath);
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        return await res.json();
      }
    } catch {
      // API not available — fall through to static file
    }
    const res = await fetch(`${base}${staticPath}`);
    if (!res.ok) throw new Error(`Không tải được ${staticPath}`);
    return res.json();
  };

  const [questions, students] = await Promise.all([
    fetchJson('/api/questions', 'data/questions.json'),
    fetchJson('/api/students', 'data/students.json'),
  ]);
  return { questions, students };
}

/* ──────────── Component ──────────── */

export default function App() {
  const [data, setData] = useState<QuestionData[]>([]);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [examName, setExamName] = useState('Kì Thi Khảo Sát');
  const [topicMap, setTopicMap] = useState<Record<string, number[]> | null>(null);
  const [knowledgeCsv, setKnowledgeCsv] = useState<string>(() => localStorage.getItem('knowledge_csv') || DEFAULT_KNOWLEDGE_CSV);
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>(defaultQuestionTexts as Record<string, string>);
  const [answerLink, setAnswerLink] = useState('');
  const [nextExamDate, setNextExamDate] = useState('');
  const [examUrl, setExamUrl] = useState('');
  const [sbdMap, setSbdMap] = useState<Record<string, string>>({});
  const [showTv, setShowTv] = useState(true);
  const [showTa, setShowTa] = useState(true);
  const [showToan, setShowToan] = useState(true);
  const [showTdkh, setShowTdkh] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');
  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);


  // Hash-based routing for hidden admin access
  useEffect(() => {
    const checkHash = () => setIsAdmin(window.location.hash === '#admin');
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Fetch exam settings from Supabase (name, topic map, question texts, knowledge csv)
  useEffect(() => {
    if (!supabase) return;
    supabase.from('exam_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === 'exam_name' && row.value) setExamName(row.value);
        if (row.key === 'knowledge_csv' && row.value) {
          setKnowledgeCsv(row.value);
          try { localStorage.setItem('knowledge_csv', row.value); } catch {}
        }
        if (row.key === 'topic_map') try { setTopicMap(JSON.parse(row.value)); } catch {}
        if (row.key === 'question_texts') try { setQuestionTexts(JSON.parse(row.value)); } catch {}
        if (row.key === 'answer_link' && row.value) setAnswerLink(row.value);
        if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'exam_url' && row.value) setExamUrl(row.value);
        if (row.key === 'sbd_map') try { setSbdMap(JSON.parse(row.value)); } catch {}
        if (row.key === 'show_tv') setShowTv(row.value !== 'false');
        if (row.key === 'show_ta') setShowTa(row.value !== 'false');
        if (row.key === 'show_toan') setShowToan(row.value !== 'false');
        if (row.key === 'show_tdkh') setShowTdkh(row.value !== 'false');
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    // Try Supabase first (if configured)
    if (isSupabaseConfigured) {
      const supa = await fetchFromSupabase();
      if (supa) {
        setData(supa.questions);
        setStudentData(supa.students);
        setIsLoading(false);
        return;
      }
    }

    // Fall back to static JSON files
    try {
      const { questions, students } = await fetchFromStatic();
      setData(questions);
      setStudentData(students);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setLoadError(err?.message || 'Đã có lỗi xảy ra khi tải dữ liệu.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Admin route
  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#f8fafc] dark:bg-slate-900 transition-colors duration-300">
        <button onClick={() => setIsDark(!isDark)} className="fixed top-4 left-4 z-50 p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-700 dark:text-slate-200 hover:scale-110 transition-all">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          <AdminPage 
            onExit={() => { window.location.hash = ''; setIsAdmin(false); }} 
            visibleParts={{ tv: showTv, ta: showTa, toan: showToan, tdkh: showTdkh }}
          />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Không tải được dữ liệu</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 max-w-md">{loadError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full relative bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 overflow-x-hidden font-sans selection:bg-blue-500 selection:text-white transition-colors duration-500">
      {/* Dark Tech Mesh Glow Background System (No dots/textures) */}
      <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
        {/* Deep Obsidian Space Base */}
        <div className="absolute inset-0 bg-[#F8FAFC] dark:bg-[#07090E] transition-colors duration-500" />

        {/* Top-Center Electric Blue & Indigo Aurora Dome */}
        <div 
          className="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[900px] sm:w-[1300px] h-[650px] rounded-full pointer-events-none opacity-80 dark:opacity-100"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(37, 99, 235, 0.22) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 70%)',
            filter: 'blur(100px)'
          }}
        />

        {/* Top-Right Cyan Glow Accent */}
        <div 
          className="absolute top-[5%] -right-[10%] w-[500px] sm:w-[700px] h-[550px] rounded-full pointer-events-none opacity-70 dark:opacity-90"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(14, 165, 233, 0.05) 50%, transparent 70%)',
            filter: 'blur(110px)'
          }}
        />

        {/* Bottom-Left Royal Indigo Accent */}
        <div 
          className="absolute -bottom-[15%] -left-[10%] w-[600px] sm:w-[800px] h-[600px] rounded-full pointer-events-none opacity-70 dark:opacity-90"
          style={{
            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.14) 0%, rgba(67, 56, 202, 0.06) 50%, transparent 70%)',
            filter: 'blur(120px)'
          }}
        />

        {/* Center Atmospheric Depth Glow */}
        <div 
          className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none opacity-40 dark:opacity-60"
          style={{
            background: 'radial-gradient(ellipse, rgba(30, 58, 138, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)'
          }}
        />

        {/* Top Precision Horizon Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 dark:via-blue-400/35 to-transparent" />
      </div>

      {/* Theme Toggle Button */}
      <button 
        onClick={() => setIsDark(!isDark)} 
        aria-label="Chuyển chế độ sáng/tối"
        title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-40 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 shadow-lg shadow-slate-900/5 dark:shadow-black/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        {isDark ? <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-700" />}
      </button>

      {/* Main Content Layer */}
      <main className="relative z-10 w-full h-full min-h-[100dvh] flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <Dashboard 
            questions={data} 
            students={studentData} 
            examName={examName} 
            topicMap={topicMap} 
            knowledgeCsv={knowledgeCsv}
            questionTexts={questionTexts} 
            answerLink={answerLink} 
            nextExamDate={nextExamDate}
            sbdMap={sbdMap}
            visibleParts={{ tv: showTv, ta: showTa, toan: showToan, tdkh: showTdkh }}
          />
        )}

        {/* Footer */}
        {!isLoading && (
          <div className="mt-auto pt-10 pb-6 w-full text-center flex-shrink-0 relative z-20">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md inline-flex items-center gap-1.5 px-4 py-2 rounded-full shadow-xs border border-slate-200/80 dark:border-slate-800">
              <span>Nếu có bất kì lỗi gì về trang web, hãy liên hệ qua</span>
              <a href="https://discordapp.com/users/734403880208564235" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center hover:scale-110 transition-transform">
                <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="h-4.5 w-auto" />
              </a>
            </p>
          </div>
        )}
      </main>
      {/* Hidden Admin Login Button */}
      {!isAdmin && (
        <button
          onClick={() => { window.location.hash = '#admin'; }}
          className="fixed top-0 right-0 w-12 h-12 z-50 opacity-0 cursor-default"
          aria-hidden="true"
          tabIndex={-1}
          title="Admin Access"
        />
      )}

      {/* Floating QR Code */}
      {examUrl && !isAdmin && (
        <a href={examUrl} target="_blank" rel="noopener noreferrer" className="relative sm:fixed sm:bottom-4 sm:right-4 z-40 mx-auto w-fit mt-4 mb-6 sm:mt-0 sm:mb-0 bg-white dark:bg-slate-800 p-2 sm:p-2.5 rounded-2xl shadow-xl border-2 border-indigo-100 flex flex-col items-center gap-1.5 hover:scale-105 hover:-translate-y-1 transition-all origin-bottom-right group cursor-pointer">
          <p className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-wide group-hover:text-indigo-700">Mã làm bài thi</p>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(examUrl)}`} alt="QR Code" className="w-14 h-14 sm:w-[120px] sm:h-[120px]" />
        </a>
      )}
    </div>
  );
}
