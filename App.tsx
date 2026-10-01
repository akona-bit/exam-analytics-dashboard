/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './Dashboard';
import { AdminPage } from './AdminPage';
import { QuestionData, StudentData } from './types';
import defaultQuestionTexts from './question_texts.json';
import { supabase, isSupabaseConfigured } from './lib/supabase';

/* ──────────── Supabase → App type mapping ──────────── */

interface SupabaseStudent {
  stt: number; name: string; email: string | null;
  tho_toan: number | null; tho_tdkh: number | null;
  irt_toan: number | null; irt_tdkh: number | null;
  tp_toan: number | null; tp_tdkh: number | null;
  note: string | null;
}
interface SupabaseQuestion {
  question_id: string; subject: string;
  total_attempts: number | null; correct: number | null; incorrect: number | null;
  penalty_score: number | null; bonus1: number | null; bonus2: number | null;
  bonus3: number | null; bonus_correct: number | null; is_error: boolean | null;
}
interface SupabaseResponse {
  student_stt: number; student_name: string;
  question_num: number; status: string;
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

    // Group responses by student_stt
    const responsesByStt = new Map<number, { question_num: number; status: string }[]>();
    for (const r of (responsesRes.data || []) as SupabaseResponse[]) {
      if (!responsesByStt.has(r.student_stt)) responsesByStt.set(r.student_stt, []);
      responsesByStt.get(r.student_stt)!.push({ question_num: r.question_num, status: r.status });
    }

    // Map students
    const students: StudentData[] = (studentsRes.data as SupabaseStudent[]).map(s => ({
      stt: s.stt,
      name: s.name,
      email: s.email || undefined,
      tho: { toan: s.tho_toan, tdkh: s.tho_tdkh },
      irt: { toan: s.irt_toan, tdkh: s.irt_tdkh },
      thuongPhat: { toan: s.tp_toan, tdkh: s.tp_tdkh },
      note: s.note || undefined,
      responses: responsesByStt.get(s.stt),
    }));

    // Map questions
    const questions: QuestionData[] = (questionsRes.data as SupabaseQuestion[]).map(q => ({
      id: q.question_id,
      subject: q.subject,
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
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>(defaultQuestionTexts as Record<string, string>);
  const [answerLink, setAnswerLink] = useState('');
  const [nextExamDate, setNextExamDate] = useState('');
  const [sbdMap, setSbdMap] = useState<Record<string, string>>({});

  // Hash-based routing for hidden admin access
  useEffect(() => {
    const checkHash = () => setIsAdmin(window.location.hash === '#admin');
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Fetch exam settings from Supabase (name, topic map, question texts)
  useEffect(() => {
    if (!supabase) return;
    supabase.from('exam_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === 'exam_name' && row.value) setExamName(row.value);
        if (row.key === 'topic_map') try { setTopicMap(JSON.parse(row.value)); } catch {}
        if (row.key === 'question_texts') try { setQuestionTexts(JSON.parse(row.value)); } catch {}
        if (row.key === 'answer_link' && row.value) setAnswerLink(row.value);
        if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'sbd_map') try { setSbdMap(JSON.parse(row.value)); } catch {}
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
      <div className="min-h-[100dvh] w-screen bg-[#f8fafc]">
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          <AdminPage onExit={() => { window.location.hash = ''; setIsAdmin(false); }} />
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
          <h2 className="text-lg font-bold text-slate-800 mb-1">Không tải được dữ liệu</h2>
          <p className="text-sm text-slate-500 max-w-md">{loadError}</p>
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
    <div 
      className="min-h-[100dvh] w-screen relative bg-slate-50 overflow-x-hidden"
      style={{
        backgroundImage: 'url("/bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <main className="relative z-10 w-full h-full min-h-[100dvh] flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <Dashboard 
            questions={data} 
            students={studentData} 
            examName={examName} 
            topicMap={topicMap} 
            questionTexts={questionTexts} 
            answerLink={answerLink} 
            nextExamDate={nextExamDate}
            sbdMap={sbdMap}
          />
        )}
      </main>
      {/* Hidden admin access button */}
      <button
        onClick={() => { window.location.hash = '#admin'; }}
        className="fixed bottom-3 right-3 w-3 h-3 rounded-full bg-slate-400 opacity-[0.05] hover:opacity-[0.15] transition-opacity cursor-default z-10"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
