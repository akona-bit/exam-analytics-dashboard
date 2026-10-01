import React, { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { QuestionData, StudentData } from './types';
import {
  Upload, LogOut, Database, Trash2, CheckCircle2, AlertCircle,
  FileSpreadsheet, Users, BookOpen, ChevronLeft, Loader2, Settings, Save,
} from 'lucide-react';
import defaultQuestionTexts from './question_texts.json';
import { defaultTopicMap } from './KnowledgeMatrix';

/* ──────────── CSV Parser ──────────── */
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"') { current += '"'; i++; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

const readLines = (text: string) => text.split('\n').map(l => l.trim()).filter(l => l);

/* ──────────── Data parsers (mirrors scripts/export-data.cjs) ──────────── */

function parseStudents(csv: string) {
  const rows: any[] = [];
  const lines = readLines(csv).slice(2);
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length >= 8) {
      rows.push({
        stt: parseInt(parts[0], 10),
        name: parts[2] || parts[1],
        email: parts[3] || null,
        tho_toan: parseFloat(parts[4]),
        tho_tdkh: parseFloat(parts[5]),
        irt_toan: parseFloat(parts[6]),
        irt_tdkh: parseFloat(parts[7]),
        tp_toan: parseFloat(parts[8]),
        tp_tdkh: parseFloat(parts[9]),
        note: '',
      });
    }
  }
  return rows;
}

function parseResponses(csv: string, students: any[]) {
  const responses: any[] = [];
  const lines = readLines(csv).slice(1);
  let stt = 1;
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length < 74) continue;
    let name = parts[0] || parts[1];
    let email = parts[3] || parts[9] || null;
    let qStartIdx = 14;
    const checkIdx = parts.findIndex(p => p && p.trim().toUpperCase() === 'TRUE');
    if (checkIdx !== -1) {
      name = parts[checkIdx - 10] || parts[checkIdx - 11];
      email = parts[checkIdx - 8] || parts[checkIdx - 2] || null;
      qStartIdx = checkIdx + 3;
    } else {
      const first = parts.findIndex(p => p && p.trim().length > 0);
      if (first > 0 && first <= 6) { name = parts[first] || parts[first + 1]; qStartIdx = first + 14; }
    }
    if (!name) continue;
    if (email) {
      const exact = students.find(s => s.name === name && s.stt === stt);
      if (exact) exact.email = email;
      else { const any = students.find(s => s.name === name); if (any && !any.email) any.email = email; }
    }
    for (let i = 0; i < 60; i++) {
      let val = parts[qStartIdx + i];
      if (val) val = val.trim();
      let status = 'wrong';
      if (val === '1' || val === '1.0' || val === '1.00' || val === '0.1' || val === '0.25' || val === '0.5') status = 'correct';
      else if (val === '0' || val === '0.0' || val === '0.00') status = 'wrong';
      else if (val === '' || val === '-1' || val === '\r' || val === '\r\n' || !val) status = 'missing';
      else { const n = parseFloat(val); if (n > 0) status = 'correct'; else if (n === 0) status = 'wrong'; else status = 'missing'; }
      if (i + 1 === 4) status = 'correct';
      if (status !== 'correct') responses.push({ student_stt: stt, student_name: name, question_num: i + 1, status });
    }
    stt++;
  }
  return responses;
}

function parseQuestions(csv: string) {
  const rows: any[] = [];
  const lines = readLines(csv).slice(2);
  let cur = '';
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length >= 11) {
      if (parts[0]) cur = parts[0];
      const num = (v: string) => v ? parseFloat(v) : null;
      const int = (v: string) => v ? parseInt(v, 10) : null;
      rows.push({
        question_id: parts[1], subject: cur,
        total_attempts: int(parts[2]), correct: int(parts[3]), incorrect: int(parts[4]),
        penalty_score: num(parts[5]), bonus1: num(parts[6]), bonus2: num(parts[7]),
        bonus3: num(parts[8]), bonus_correct: num(parts[9]),
        is_error: parts[2] === 'LỖI ĐỀ THI' || parts[1] === 'Câu 4',
      });
    }
  }
  return rows;
}

/* ──────────── Helper: fetch stats ──────────── */
async function fetchStats() {
  if (!supabase) return null;
  const [{ count: studentCount }, { count: questionCount }, { count: responseCount }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('student_responses').select('*', { count: 'exact', head: true }),
  ]);
  return { students: studentCount ?? 0, questions: questionCount ?? 0, responses: responseCount ?? 0 };
}

/* ──────────── Component ──────────── */
interface AdminPageProps {
  onExit: () => void;
}

export function AdminPage({ onExit }: AdminPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Upload state
  const [studentsFile, setStudentsFile] = useState<File | null>(null);
  const [responsesFile, setResponsesFile] = useState<File | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Stats
  const [stats, setStats] = useState<{ students: number; questions: number; responses: number } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Exam name
  const [examName, setExamName] = useState('');
  const [examNameSaving, setExamNameSaving] = useState(false);
  const [examNameStatus, setExamNameStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Settings: Topic Map
  const [topicMapStr, setTopicMapStr] = useState(JSON.stringify(defaultTopicMap, null, 2));
  const [topicMapSaving, setTopicMapSaving] = useState(false);
  const [topicMapStatus, setTopicMapStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Settings: Question Texts
  const [questionTextsStr, setQuestionTextsStr] = useState(JSON.stringify(defaultQuestionTexts, null, 2));
  const [questionTextsSaving, setQuestionTextsSaving] = useState(false);
  const [questionTextsStatus, setQuestionTextsStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Additional Info
  const [answerLink, setAnswerLink] = useState('');
  const [answerLinkSaving, setAnswerLinkSaving] = useState(false);
  const [answerLinkStatus, setAnswerLinkStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [nextExamDate, setNextExamDate] = useState('');
  const [nextExamDateSaving, setNextExamDateSaving] = useState(false);
  const [nextExamDateStatus, setNextExamDateStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // SBD Mapping
  const [sbdMapStr, setSbdMapStr] = useState('');
  const [sbdMapSaving, setSbdMapSaving] = useState(false);
  const [sbdMapStatus, setSbdMapStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const refreshStats = useCallback(async () => {
    try { setStats(await fetchStats()); } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) { setAuthed(true); refreshStats(); }
    });
    // Fetch exam settings
    supabase?.from('exam_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === 'exam_name' && row.value) setExamName(row.value);
        if (row.key === 'topic_map' && row.value) setTopicMapStr(row.value);
        if (row.key === 'question_texts' && row.value) setQuestionTextsStr(row.value);
        if (row.key === 'answer_link' && row.value) setAnswerLink(row.value);
        if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'sbd_map' && row.value) {
          try {
            const map = JSON.parse(row.value);
            // Convert JSON map back to TSV string
            const lines = Object.entries(map).map(([k, v]) => `${k}\t${v}`);
            setSbdMapStr(lines.join('\n'));
          } catch {}
        }
      }
    });
  }, [refreshStats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true); setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
    else { setAuthed(true); refreshStats(); }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setAuthed(false); setStats(null);
  };

  const handleSaveExamName = async () => {
    if (!supabase || !examName.trim()) return;
    setExamNameSaving(true);
    setExamNameStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'exam_name', value: examName.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setExamNameStatus({ type: 'success', msg: 'Đã lưu tên kì thi thành công!' });
      setTimeout(() => setExamNameStatus(null), 3000);
    } catch (err: any) {
      setExamNameStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setExamNameSaving(false);
  };

  const handleSaveAnswerLink = async () => {
    if (!supabase) return;
    setAnswerLinkSaving(true);
    setAnswerLinkStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'answer_link', value: answerLink.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setAnswerLinkStatus({ type: 'success', msg: 'Đã lưu link đáp án thành công!' });
      setTimeout(() => setAnswerLinkStatus(null), 3000);
    } catch (err: any) {
      setAnswerLinkStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setAnswerLinkSaving(false);
  };

  const handleSaveNextExamDate = async () => {
    if (!supabase) return;
    setNextExamDateSaving(true);
    setNextExamDateStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'next_exam_date', value: nextExamDate.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setNextExamDateStatus({ type: 'success', msg: 'Đã lưu thời gian đợt thi thành công!' });
      setTimeout(() => setNextExamDateStatus(null), 3000);
    } catch (err: any) {
      setNextExamDateStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setNextExamDateSaving(false);
  };

  const handleSaveSbdMap = async () => {
    if (!supabase) return;
    setSbdMapSaving(true);
    setSbdMapStatus(null);
    try {
      const map: Record<string, string> = {};
      const lines = sbdMapStr.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        // Split by tab or comma
        const parts = line.split(/\t|,/).map(p => p.trim());
        if (parts.length >= 2) {
          map[parts[0]] = parts[1];
        }
      }
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'sbd_map', value: JSON.stringify(map), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setSbdMapStatus({ type: 'success', msg: 'Đã lưu danh sách SBD thành công!' });
      setTimeout(() => setSbdMapStatus(null), 3000);
    } catch (err: any) {
      setSbdMapStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setSbdMapSaving(false);
  };

  const handleSaveTopicMap = async () => {
    if (!supabase || !topicMapStr.trim()) return;
    try {
      JSON.parse(topicMapStr);
    } catch {
      setTopicMapStatus({ type: 'error', msg: 'Lỗi: Chuỗi JSON không hợp lệ!' });
      return;
    }
    setTopicMapSaving(true);
    setTopicMapStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'topic_map', value: topicMapStr.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setTopicMapStatus({ type: 'success', msg: 'Đã lưu ma trận kiến thức thành công!' });
      setTimeout(() => setTopicMapStatus(null), 3000);
    } catch (err: any) {
      setTopicMapStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setTopicMapSaving(false);
  };

  const handleSaveQuestionTexts = async () => {
    if (!supabase || !questionTextsStr.trim()) return;
    try {
      JSON.parse(questionTextsStr);
    } catch {
      setQuestionTextsStatus({ type: 'error', msg: 'Lỗi: Chuỗi JSON không hợp lệ!' });
      return;
    }
    setQuestionTextsSaving(true);
    setQuestionTextsStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'question_texts', value: questionTextsStr.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setQuestionTextsStatus({ type: 'success', msg: 'Đã lưu nội dung câu hỏi thành công!' });
      setTimeout(() => setQuestionTextsStatus(null), 3000);
    } catch (err: any) {
      setQuestionTextsStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setQuestionTextsSaving(false);
  };

  // ── Upload handler ──
  const handleUpload = async () => {
    if (!supabase) return;
    if (!studentsFile || !responsesFile || !questionsFile) {
      setUploadStatus({ type: 'error', msg: 'Vui lòng chọn đủ 3 file CSV.' });
      return;
    }
    setLoading(true);
    setUploadStatus(null);
    try {
      // Parse CSVs
      setUploadProgress('Đang đọc file CSV...');
      const studentsCsv = await studentsFile.text();
      const responsesCsv = await responsesFile.text();
      const questionsCsv = await questionsFile.text();

      const parsedStudents = parseStudents(studentsCsv);
      const parsedResponses = parseResponses(responsesCsv, parsedStudents);
      const parsedQuestions = parseQuestions(questionsCsv);

      // Clear old data
      setUploadProgress('Đang xoá dữ liệu cũ...');
      await supabase.from('student_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Insert students (batch 500)
      setUploadProgress(`Đang tải ${parsedStudents.length} học sinh...`);
      for (let i = 0; i < parsedStudents.length; i += 500) {
        await supabase.from('students').insert(parsedStudents.slice(i, i + 500));
      }

      // Insert questions
      setUploadProgress(`Đang tải ${parsedQuestions.length} câu hỏi...`);
      await supabase.from('questions').insert(parsedQuestions);

      // Insert responses (batch 1000)
      setUploadProgress(`Đang tải ${parsedResponses.length} bản ghi câu sai/bỏ trống...`);
      for (let i = 0; i < parsedResponses.length; i += 1000) {
        await supabase.from('student_responses').insert(parsedResponses.slice(i, i + 1000));
      }

      setUploadProgress('');
      setUploadStatus({
        type: 'success',
        msg: `Đã tải lên thành công: ${parsedStudents.length} học sinh, ${parsedQuestions.length} câu hỏi, ${parsedResponses.length} bản ghi câu sai/bỏ trống.`,
      });
      await refreshStats();
    } catch (err: any) {
      setUploadProgress('');
      setUploadStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setLoading(false);
  };

  const handleClearAll = async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.from('student_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLoading(false);
    setClearConfirm(false);
    await refreshStats();
  };

  /* ── Not configured ── */
  if (!isSupabaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <BackButton onExit={onExit} />
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Chưa cấu hình Supabase</h2>
          <p className="text-sm text-slate-500 mb-4">
            Để sử dụng trang admin, cần tạo file <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">.env</code> với:
          </p>
          <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 text-left overflow-x-auto">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
          </pre>
          <p className="text-sm text-slate-500 mt-4">
            Sau đó chạy SQL schema trong <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600">schema.sql</code> tại Supabase SQL Editor.
          </p>
        </div>
      </div>
    );
  }

  /* ── Login screen ── */
  if (!authed) {
    return (
      <div className="max-w-md mx-auto p-6">
        <BackButton onExit={onExit} />
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Database className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Admin Login</h2>
            <p className="text-sm text-slate-500 mt-1">Đăng nhập để quản lý dữ liệu</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium transition-all bg-white"
            />
            <input
              type="password" placeholder="Mật khẩu" value={password}
              onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium transition-all bg-white"
            />
            {authError && (
              <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 px-4 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" /> {authError}
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ── Admin dashboard ── */
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <BackButton onExit={onExit} />
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium text-sm px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors">
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Học sinh" value={stats.students} color="indigo" />
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Câu hỏi" value={stats.questions} color="sky" />
          <StatCard icon={<FileSpreadsheet className="w-5 h-5" />} label="Bản ghi câu sai" value={stats.responses} color="amber" />
        </div>
      )}

      {/* Exam settings section */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-indigo-500" />
          Cài đặt kì thi
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tên kì thi</label>
            <input
              type="text"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              placeholder="Ví dụ: Kì Thi Khảo Sát Toán & TDKH - Đợt 3"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium transition-all bg-white"
            />
          </div>
          {examNameStatus && (
            <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${examNameStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {examNameStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {examNameStatus.msg}
            </div>
          )}
          <button
            onClick={handleSaveExamName}
            disabled={examNameSaving || !examName.trim()}
            className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {examNameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          Cài đặt hiển thị phụ
        </h2>
        
        <div className="flex flex-col gap-5">
          {/* Answer Link */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Link đáp án chi tiết (Hiển thị cho thí sinh)</label>
            <input
              type="text"
              value={answerLink}
              onChange={e => setAnswerLink(e.target.value)}
              placeholder="VD: https://docs.google.com/..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            {answerLinkStatus && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg mt-1 w-fit ${answerLinkStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {answerLinkStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {answerLinkStatus.msg}
              </div>
            )}
            <button
              onClick={handleSaveAnswerLink}
              disabled={answerLinkSaving}
              className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2 mt-1"
            >
              {answerLinkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu link đáp án
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Next Exam Date */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Dự kiến đợt thi tiếp theo (Văn bản ngắn)</label>
            <input
              type="text"
              value={nextExamDate}
              onChange={e => setNextExamDate(e.target.value)}
              placeholder="VD: Chủ Nhật tuần sau, 20h00"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            {nextExamDateStatus && (
              <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg mt-1 w-fit ${nextExamDateStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {nextExamDateStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {nextExamDateStatus.msg}
              </div>
            )}
            <button
              onClick={handleSaveNextExamDate}
              disabled={nextExamDateSaving}
              className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2 mt-1"
            >
              {nextExamDateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu dự kiến đợt thi
            </button>
          </div>
        </div>
      </div>

      {/* SBD Mapping */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-500" />
          Danh sách Số Báo Danh (SBD)
        </h2>
        <p className="text-sm text-slate-500 mb-3">Copy 2 cột từ Excel (Họ Tên và SBD) rồi dán vào đây. Học sinh sẽ phải nhập đúng SBD này khi tra cứu điểm. Nếu để trống, hệ thống chỉ yêu cầu nhập tên.</p>
        <div className="flex flex-col gap-3">
          <div>
            <textarea
              value={sbdMapStr}
              onChange={e => setSbdMapStr(e.target.value)}
              placeholder="Nguyễn Văn A    123456&#10;Trần Thị B    654321"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white h-48 font-mono text-sm"
            />
          </div>
          {sbdMapStatus && (
            <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${sbdMapStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {sbdMapStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {sbdMapStatus.msg}
            </div>
          )}
          <button
            onClick={handleSaveSbdMap}
            disabled={sbdMapSaving}
            className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {sbdMapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu danh sách SBD
          </button>
        </div>
      </div>

      {/* Topic Map Settings */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-indigo-500" />
          Ma trận kiến thức (JSON)
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <textarea
              value={topicMapStr}
              onChange={e => setTopicMapStr(e.target.value)}
              placeholder='Ví dụ: { "Hàm số bậc 2": [6, 14] }'
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white h-48 font-mono text-xs"
            />
          </div>
          {topicMapStatus && (
            <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${topicMapStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {topicMapStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {topicMapStatus.msg}
            </div>
          )}
          <button
            onClick={handleSaveTopicMap}
            disabled={topicMapSaving || !topicMapStr.trim()}
            className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {topicMapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu ma trận
          </button>
        </div>
      </div>

      {/* Question Texts Settings */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-indigo-500" />
          Nội dung câu hỏi (JSON)
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <textarea
              value={questionTextsStr}
              onChange={e => setQuestionTextsStr(e.target.value)}
              placeholder='Ví dụ: { "Câu 1": "Nội dung câu 1" }'
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white h-48 font-mono text-xs"
            />
          </div>
          {questionTextsStatus && (
            <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${questionTextsStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {questionTextsStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {questionTextsStatus.msg}
            </div>
          )}
          <button
            onClick={handleSaveQuestionTexts}
            disabled={questionTextsSaving || !questionTextsStr.trim()}
            className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
          >
            {questionTextsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu nội dung câu hỏi
          </button>
        </div>
      </div>

      {/* Upload section */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-indigo-500" />
          Tải lên dữ liệu mới
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Chọn 3 file CSV. Dữ liệu cũ sẽ bị xoá và thay thế bằng dữ liệu mới.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FileInput label="raw_students.csv" file={studentsFile} onChange={setStudentsFile} />
          <FileInput label="raw_student_responses.csv" file={responsesFile} onChange={setResponsesFile} />
          <FileInput label="questions.csv" file={questionsFile} onChange={setQuestionsFile} />
        </div>

        {uploadProgress && (
          <div className="mt-4 flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-4 py-2.5 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {uploadProgress}
          </div>
        )}

        {uploadStatus && (
          <div className={`mt-4 flex items-start gap-2 text-sm px-4 py-2.5 rounded-lg ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {uploadStatus.msg}
          </div>
        )}

        <button
          onClick={handleUpload} disabled={loading || !studentsFile || !responsesFile || !questionsFile}
          className="mt-5 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          Tải lên toàn bộ
        </button>
      </div>

      {/* Danger zone */}
      <div className="card p-5 sm:p-6 border-2 border-rose-100">
        <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2 mb-3">
          <Trash2 className="w-5 h-5" />
          Vùng nguy hiểm
        </h2>
        <p className="text-sm text-slate-500 mb-4">Xoá toàn bộ dữ liệu trong database. Không thể hoàn tác.</p>
        {!clearConfirm ? (
          <button onClick={() => setClearConfirm(true)} className="px-4 py-2 rounded-lg border-2 border-rose-200 text-rose-600 font-semibold text-sm hover:bg-rose-50 transition-colors">
            Xoá toàn bộ dữ liệu
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-rose-600">Bạn chắc chắn?</span>
            <button onClick={handleClearAll} disabled={loading} className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50">
              {loading ? 'Đang xoá...' : 'Đồng ý, xoá hết'}
            </button>
            <button onClick={() => setClearConfirm(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors">
              Huỷ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function BackButton({ onExit }: { onExit: () => void }) {
  return (
    <button onClick={onExit} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium text-sm transition-colors">
      <ChevronLeft className="w-4 h-4" /> Quay lại
    </button>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value.toLocaleString('vi-VN')}</p>
      </div>
    </div>
  );
}

function FileInput({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  const id = label.replace(/[^a-z0-9]/gi, '-');
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      <label
        htmlFor={id}
        className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${file ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
      >
        {file ? (
          <>
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700 truncate max-w-full">{file.name}</span>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-slate-300" />
            <span className="text-xs text-slate-400">Chọn file</span>
          </>
        )}
      </label>
      <input id={id} type="file" accept=".csv" className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}
