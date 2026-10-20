/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './components/dashboard/Dashboard';
import { AdminPage } from './components/admin/AdminPage';
import { QuestionData, StudentData } from './types';
import { questionTextsFile } from './lib/contentFiles';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { DEFAULT_KNOWLEDGE_CSV } from './lib/knowledgeStructure';
import { enrichQuestions, enrichStudents } from './lib/referenceStats';
import { fillMissingRawScores } from './lib/analytics';
import { SkyBackground } from './components/layout/SkyBackground';

/* ──────────── Supabase → App type mapping ──────────── */

interface SupabaseStudent {
  stt: number; name: string; email: string | null;
  sbd: string | null; gender: string | null; ma_de: string | null;
  tho_toan: number | null; tho_tdkh: number | null; tho_tv: number | null; tho_ta: number | null;
  irt_toan: number | null; irt_tdkh: number | null; irt_tv: number | null; irt_ta: number | null;
  total_correct: number | null; total_points: number | null;
  note: string | null;
}
interface SupabaseQuestion {
  question_id: string; subject: string;
  total_attempts: number | null; correct: number | null; incorrect: number | null;
  difficulty: number | null; discrimination: number | null; is_error: boolean | null;
}
interface SupabaseResponse {
  student_stt: number;
  question_num: number; status: string;
}

/**
 * Bọc một promise để nó không bao giờ treo vô hạn.
 * Trả về `null` khi hết thời gian — promise gốc vẫn chạy nền nhưng không ai chờ nó nữa.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`${label}: quá ${Math.round(ms / 1000)}s, bỏ qua và dùng nguồn dữ liệu dự phòng.`);
      resolve(null);
    }, ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Thời gian chờ tối đa cho Supabase. Bảng `student_responses` có ~42k dòng và được
 * đọc với RLS cho phép anonymous, nên cần đủ rộng cho mạng chậm — nhưng không được
 * để người dùng nhìn "Đang tải dữ liệu..." mãi. Hết giờ sẽ fallback sang
 * `/api/*` rồi tới file JSON tĩnh trong `public/data/`.
 */
const SUPABASE_TIMEOUT_MS = 12000;

/** Fetch all data from Supabase. Returns null ONLY if Supabase connection/query failed. */
async function fetchFromSupabase(): Promise<{ questions: QuestionData[]; students: StudentData[] } | null> {
  if (!supabase) return null;

  try {
    const pending = await withTimeout(Promise.all([
      supabase.from('students').select('*').order('stt', { ascending: true }),
      supabase.from('questions').select('*'),
      supabase.from('student_responses').select('*'),
    ]), SUPABASE_TIMEOUT_MS, 'Tải dữ liệu từ Supabase');
    if (pending === null) return null;
    const [studentsRes, questionsRes, responsesRes] = pending;

    // If query failed with error, return null to fall back
    if (studentsRes.error || questionsRes.error || responsesRes.error) {
      console.warn('Lỗi truy vấn Supabase:', studentsRes.error || questionsRes.error || responsesRes.error);
      return null;
    }

    const rawStudents = (studentsRes.data || []) as SupabaseStudent[];
    const rawQuestions = (questionsRes.data || []) as SupabaseQuestion[];
    const rawResponses = (responsesRes.data || []) as SupabaseResponse[];

    // Supabase trả về 200 + mảng rỗng khi bảng chưa được nạp dữ liệu. Đó KHÔNG phải
    // lỗi, nhưng nếu chấp nhận thì dashboard sẽ trống và fallback sang file JSON tĩnh
    // (public/data/*.json) không bao giờ chạy. Coi như "chưa có dữ liệu" để rơi xuống.
    if (rawStudents.length === 0 || rawQuestions.length === 0) {
      console.warn(
        `Supabase trả về 0 dòng (students=${rawStudents.length}, questions=${rawQuestions.length}) — dùng dữ liệu tĩnh.`
      );
      return null;
    }

    // Group responses by student_stt
    const responsesByKey = new Map<number, { question_num: number; status: string }[]>();
    for (const r of rawResponses) {
      if (!responsesByKey.has(r.student_stt)) responsesByKey.set(r.student_stt, []);
      responsesByKey.get(r.student_stt)!.push({ question_num: r.question_num, status: r.status });
    }

    // Map students
    const students: StudentData[] = rawStudents.map(s => ({
      stt: s.stt,
      name: s.name,
      email: s.email || undefined,
      sbd: s.sbd || undefined,
      gender: s.gender || undefined,
      maDe: s.ma_de || undefined,
      tho: { toan: s.tho_toan, tdkh: s.tho_tdkh, tv: s.tho_tv, ta: s.tho_ta },
      irt: { toan: s.irt_toan, tdkh: s.irt_tdkh, tv: s.irt_tv, ta: s.irt_ta },
      note: s.note || undefined,
      responses: responsesByKey.get(s.stt),
    }));

    // Map questions
    const questions: QuestionData[] = rawQuestions.map(q => ({
      id: q.question_id,
      subject: q.subject,
      totalAttempts: q.total_attempts,
      correct: q.correct,
      incorrect: q.incorrect,
      difficulty: q.difficulty,
      discrimination: q.discrimination,
      isError: q.is_error ?? undefined,
    }));

    return { questions, students };
  } catch (err) {
    console.error('Lỗi phân tích dữ liệu Supabase:', err);
    return null;
  }
}

/** Fetch from static JSON or API fallback */
async function fetchFromStatic(): Promise<{ questions: QuestionData[]; students: StudentData[] }> {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

  const fetchJson = async (staticPath: string, apiPath: string) => {
    // Ưu tiên đọc file tĩnh đã xuất sẵn trong public/data/ (tốc độ cao 5-10ms, không gây lỗi 404 network)
    try {
      const res = await fetch(`${base}${staticPath}`);
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Fall through
    }
    // Dự phòng gọi endpoint backend nếu có
    try {
      const res = await fetch(apiPath);
      if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Fall through
    }
    throw new Error(`Không tải được ${staticPath}`);
  };

  const [questions, students] = await Promise.all([
    fetchJson('data/questions.json', '/api/questions'),
    fetchJson('data/students.json', '/api/students'),
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
  const [examName, setExamName] = useState(() => {
    try {
      return localStorage.getItem('exam_name') || 'Kì Thi Thử';
    } catch {
      return 'Kì Thi Thử';
    }
  });
  const [knowledgeCsv, setKnowledgeCsv] = useState<string>(() => localStorage.getItem('knowledge_csv') || DEFAULT_KNOWLEDGE_CSV);
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>(questionTextsFile);
  const [answerLink, setAnswerLink] = useState('');
  const [nextExamDate, setNextExamDate] = useState('');
  const [examUrl, setExamUrl] = useState('');
  const [sbdMap, setSbdMap] = useState<Record<string, string>>({});
  const [showTv, setShowTv] = useState(true);
  const [showTa, setShowTa] = useState(true);
  const [showToan, setShowToan] = useState(true);
  const [showTdkh, setShowTdkh] = useState(true);
  /**
   * Toàn bộ site chỉ dùng giao diện sáng (đã bỏ dark mode) — card trắng + chữ tối.
   * Dọn luôn class `dark` và theme cũ người dùng từng lưu, tránh kẹt nền tối/chữ trắng.
   */
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('admin_theme');
      localStorage.removeItem('theme');
    } catch {}
  }, []);


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
    const pending = withTimeout(
      Promise.resolve(supabase.from('exam_settings').select('key, value')).then(({ data }) => data),
      SUPABASE_TIMEOUT_MS,
      'Tải cài đặt kỳ thi từ Supabase',
    );
    pending.then(rows => {
      if (!rows) return;
      for (const row of rows) {
        if (row.key === 'exam_name' && row.value) {
          setExamName(row.value);
          try { localStorage.setItem('exam_name', row.value); } catch {}
        }
        if (row.key === 'knowledge_csv' && row.value) {
          setKnowledgeCsv(row.value);
          try { localStorage.setItem('knowledge_csv', row.value); } catch {}
        }
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
    }).catch(err => {
      console.warn('Không tải được cài đặt kỳ thi từ Supabase:', err);
    });
  }, []);

  const loadData = useCallback(async () => {
    document.body.classList.remove('app-ready');
    setIsLoading(true);
    setLoadError(null);

    // 1. Try static JSON first (instant 5ms load)
    try {
      const staticData = await fetchFromStatic();
      if (staticData.students && staticData.students.length > 0) {
        setData(enrichQuestions(staticData.questions));
        setStudentData(
          fillMissingRawScores(
            enrichStudents(staticData.students),
            staticData.questions,
          ),
        );
        setIsLoading(false);
        return;
      }
    } catch {
      // Fall through to Supabase
    }

    // 2. Try Supabase
    if (isSupabaseConfigured) {
      const supa = await fetchFromSupabase();
      if (supa !== null && supa.students.length > 0) {
        setData(enrichQuestions(supa.questions));
        setStudentData(
          fillMissingRawScores(
            enrichStudents(supa.students),
            supa.questions,
          ),
        );
        setIsLoading(false);
        return;
      }
    }

    setLoadError('Không thể tải dữ liệu khảo sát. Vui lòng thử lại sau.');
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!isLoading) document.body.classList.add('app-ready');
  }, [isLoading]);

  // Admin route
  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#f8fafc]">
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          <AdminPage 
            onExit={() => { window.location.hash = ''; setIsAdmin(false); loadData(); }} 
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
    <div className="min-h-[100dvh] w-full relative bg-transparent overflow-x-hidden font-sans">
      {/* Nền phẳng tối giản, dịu mắt — đồng bộ với dashboard tham chiếu */}
      <SkyBackground />

      {/* Main Content Layer */}
      <main className="relative z-10 w-full h-full min-h-[100dvh] flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {isLoading ? (
          <div className="min-h-[72vh] w-full" aria-busy="true" />
        ) : (
          <Dashboard
            questions={data}
            students={studentData}
            examName={examName}
knowledgeCsv={knowledgeCsv}
            answerLink={answerLink}
            nextExamDate={nextExamDate}
            visibleParts={{ tv: showTv, ta: showTa, toan: showToan, tdkh: showTdkh }}
          />
        )}

        {/* Footer */}
        {!isLoading && (
          <div className="mt-auto pt-10 pb-6 w-full text-center flex-shrink-0 relative z-20">
            <p className="text-xs sm:text-sm font-semibold text-slate-600 bg-white inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full shadow-sm border border-slate-200">
              <span>Nếu có bất kì lỗi gì về trang web, hãy liên hệ qua</span>
              <a href="https://discordapp.com/users/734403880208564235" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#5865F2] hover:text-indigo-700 transition-colors">
                developer (@akona_e)
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
        <a href={examUrl} target="_blank" rel="noopener noreferrer" className="relative sm:fixed sm:bottom-4 sm:right-4 z-40 mx-auto w-fit mt-4 mb-6 sm:mt-0 sm:mb-0 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-1.5 hover:scale-105 hover:-translate-y-1 transition-all origin-bottom-right group cursor-pointer">
          <p className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase tracking-wide group-hover:text-indigo-800">Mã làm bài thi</p>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(examUrl)}`} alt="QR Code" className="w-14 h-14 sm:w-[120px] sm:h-[120px]" />
        </a>
      )}
    </div>
  );
}
