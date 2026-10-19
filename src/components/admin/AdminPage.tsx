import React, { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { EXAM_LABEL, GIOI_MIN, MAX_ALL_SUBJECT_SCORE, subjectMax } from '../../lib/analytics';
import {
  LogOut, Database, Trash2, CheckCircle2, AlertCircle, Users, BookOpen,
  ChevronLeft, Loader2, Settings, Save, Repeat, Award, Link2,
} from 'lucide-react';

/* ──────────── Helper: fetch stats ──────────── */

/** Đọc số từ dữ liệu Supabase, trả null nếu rỗng/không phải số (không coi null là 0). */
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

interface AttemptRow {
  stt: number;
  tv: number | null;
  ta: number | null;
  toan: number | null;
  tdkh: number | null;
}

interface Stats {
  /** Tổng số lượt thi = số dòng trong bảng `students` của kỳ thi này. */
  attempts: number;
  /** Số thí sinh khác nhau, tính theo `email || name`. */
  uniqueStudents: number;
  /** Số lần thi nhiều nhất của một thí sinh. */
  maxAttempts: number;
  /** Phân bố "n thí sinh đã thi n lần" — số lượt thi là số tự đếm, không nhập tay. */
  attemptBreakdown: { attempts: number; students: number }[];
  questions: number;
  responses: number;
  avgToan: number | null;
  avgTdkh: number | null;
  goodCount: number;
  goodTotal: number;
  hardestQ: string;
}

async function fetchStats(): Promise<Stats | null> {
  if (!supabase) return null;

  const [studentsRes, questionsRes, responsesRes, studentsData, questionsData] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('student_responses').select('*', { count: 'exact', head: true }),
    supabase
      .from('students')
      .select('stt, name, email, sbd, tho_tv, tho_ta, tho_toan, tho_tdkh'),
    supabase
      .from('questions')
      .select('question_id, incorrect, correct, total_attempts, is_error'),
  ]);

  // Số lần thi và số thí sinh đều tự đếm — một thí sinh thi nhiều lần thì có n
  // dòng trong `students`, nằm cùng một nhóm khoá theo email/name.
  const byStudent = new Map<string, AttemptRow[]>();
  for (const s of (studentsData.data ?? []) as any[]) {
    const key = s.email || s.name;
    const row: AttemptRow = {
      stt: num(s.stt) ?? 0,
      tv: num(s.tho_tv),
      ta: num(s.tho_ta),
      toan: num(s.tho_toan),
      tdkh: num(s.tho_tdkh),
    };
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key)!.push(row);
  }

  const attemptBreakdown = [...byStudent.values()]
    .map(rows => {
      rows.sort((a, b) => a.stt - b.stt);
      return rows.length;
    })
    .reduce<Record<number, number>>((acc, n) => ({ ...acc, [n]: (acc[n] || 0) + 1 }), {});
  const breakdownRows = Object.entries(attemptBreakdown)
    .map(([n, students]) => ({ attempts: Number(n), students }))
    .sort((a, b) => a.attempts - b.attempts);

  // Lấy lần thi mới nhất của mỗi học sinh để tính điểm trung bình
  const latest = new Map<string, AttemptRow>();
  for (const [key, rows] of byStudent) latest.set(key, rows[rows.length - 1]);

  const rows = [...latest.values()];
  // Trung bình chỉ tính học sinh có điểm ở môn đó, không dùng 0 cho môn thiếu
  const avgOf = (pick: (r: AttemptRow) => number | null): number | null => {
    const vals = rows.map(pick).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const avgToan = avgOf(r => r.toan);
  const avgTdkh = avgOf(r => r.tdkh);

  // Điểm Giỏi tính trên thang 4 môn — chỉ xếp loại thí sinh đủ cả 4 món
  const scored = rows.filter((r): r is AttemptRow & { tv: number; ta: number; toan: number; tdkh: number } =>
    r.tv !== null && r.ta !== null && r.toan !== null && r.tdkh !== null,
  );
  const goodCount = scored.filter(r => r.tv + r.ta + r.toan + r.tdkh >= GIOI_MIN).length;

  // Câu sai nhiều nhất: so tỉ lệ sai (câu có số lượt làm khác nhau thì số tuyệt đối không tương đương),
  // bỏ câu lỗi đề (is_error) và câu không có số liệu
  const ranked = ((questionsData.data ?? []) as any[])
    .filter(q => !q.is_error)
    .map(q => {
      const incorrect = num(q.incorrect);
      const correct = num(q.correct);
      const attempts = num(q.total_attempts) ?? (correct !== null ? correct + (incorrect ?? 0) : null);
      if (incorrect === null || !attempts) return null;
      return { id: String(q.question_id), incorrect, attempts, rate: incorrect / attempts };
    })
    .filter((q): q is { id: string; incorrect: number; attempts: number; rate: number } => q !== null)
    .sort((a, b) => b.rate - a.rate);

  const hardestQ = ranked.length
    ? `${ranked[0].id} (${(ranked[0].rate * 100).toFixed(0)}% sai · ${ranked[0].incorrect}/${ranked[0].attempts} bạn)`
    : '';

  return {
    attempts: studentsRes.count ?? 0,
    uniqueStudents: byStudent.size,
    maxAttempts: breakdownRows.length ? breakdownRows[breakdownRows.length - 1].attempts : 0,
    attemptBreakdown: breakdownRows,
    questions: questionsRes.count ?? 0,
    responses: responsesRes.count ?? 0,
    avgToan,
    avgTdkh,
    goodCount,
    goodTotal: scored.length,
    hardestQ,
  };
}

/* ──────────── Component ──────────── */

interface AdminPageProps {
  onExit: () => void;
  visibleParts?: { tv: boolean; ta: boolean; toan: boolean; tdkh: boolean };
}

export function AdminPage({ onExit, visibleParts }: AdminPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [clearConfirm, setClearConfirm] = useState<false | 'all'>(false);
  const [clearStatus, setClearStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Exam name
  const [examName, setExamName] = useState('');
  const [examNameSaving, setExamNameSaving] = useState(false);
  const [examNameStatus, setExamNameStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Visibility toggles
  const [showTv, setShowTv] = useState(visibleParts?.tv ?? true);
  const [showTa, setShowTa] = useState(visibleParts?.ta ?? true);
  const [showToan, setShowToan] = useState(visibleParts?.toan ?? true);
  const [showTdkh, setShowTdkh] = useState(visibleParts?.tdkh ?? true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityStatus, setVisibilityStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Display settings
  const [answerLink, setAnswerLink] = useState('');
  const [answerLinkSaving, setAnswerLinkSaving] = useState(false);
  const [answerLinkStatus, setAnswerLinkStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [nextExamDate, setNextExamDate] = useState('');
  const [nextExamDateSaving, setNextExamDateSaving] = useState(false);
  const [nextExamDateStatus, setNextExamDateStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [examUrl, setExamUrl] = useState('');
  const [examUrlSaving, setExamUrlSaving] = useState(false);
  const [examUrlStatus, setExamUrlStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // SBD mapping
  const [sbdMapStr, setSbdMapStr] = useState('');
  const [sbdMapSaving, setSbdMapSaving] = useState(false);
  const [sbdMapStatus, setSbdMapStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const refreshStats = useCallback(async () => {
    try { setStats(await fetchStats()); } catch { /* ignore */ }
  }, []);

  // Phiên đăng nhập + cài đặt kì thi — chỉ chạy một lần khi vào trang
  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) setAuthed(true);
    });
    supabase?.from('exam_settings').select('key, value').then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        if (row.key === 'exam_name' && row.value) setExamName(row.value);
        if (row.key === 'answer_link' && row.value) setAnswerLink(row.value);
        if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'exam_url' && row.value) setExamUrl(row.value);
        if (row.key === 'show_tv') setShowTv(row.value === 'true');
        if (row.key === 'show_ta') setShowTa(row.value === 'true');
        if (row.key === 'show_toan') setShowToan(row.value === 'true');
        if (row.key === 'show_tdkh') setShowTdkh(row.value === 'true');
        if (row.key === 'sbd_map' && row.value) {
          try {
            const map = JSON.parse(row.value);
            setSbdMapStr(Object.entries(map).map(([k, v]) => `${k}\t${v}`).join('\n'));
          } catch {}
        }
      }
    });
  }, []);

  // Số liệu thống kê: chạy lại khi đăng nhập và mỗi khi đổi loại kì thi đang xem
  React.useEffect(() => {
    if (authed) refreshStats();
  }, [authed, refreshStats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true); setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
    else setAuthed(true);
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setAuthed(false); setStats(null);
  };

  /** Lưu một giá trị đơn vào `exam_settings` — dùng chung cho cả 5 ô cấu hình. */
  const saveSetting = async (
    key: string,
    value: string,
    setSaving: (v: boolean) => void,
    setStatus: (v: { type: 'success' | 'error'; msg: string } | null) => void,
    okMsg: string,
  ) => {
    if (!supabase) return;
    setSaving(true);
    setStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
      if (error) throw error;
      setStatus({ type: 'success', msg: okMsg });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setSaving(false);
  };

  const handleSaveExamName = () =>
    examName.trim() && saveSetting('exam_name', examName.trim(), setExamNameSaving, setExamNameStatus, 'Đã lưu tên kì thi thành công!');

  const handleSaveAnswerLink = () =>
    saveSetting('answer_link', answerLink.trim(), setAnswerLinkSaving, setAnswerLinkStatus, 'Đã lưu link đáp án thành công!');

  const handleSaveExamUrl = () =>
    saveSetting('exam_url', examUrl.trim(), setExamUrlSaving, setExamUrlStatus, 'Đã lưu link mã QR thành công!');

  const handleSaveNextExamDate = () =>
    saveSetting('next_exam_date', nextExamDate.trim(), setNextExamDateSaving, setNextExamDateStatus, 'Đã lưu thời gian đợt thi thành công!');

  const handleSaveVisibility = async () => {
    if (!supabase) return;
    setVisibilitySaving(true);
    setVisibilityStatus(null);
    try {
      await Promise.all([
        supabase.from('exam_settings').upsert({ key: 'show_tv', value: showTv ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('exam_settings').upsert({ key: 'show_ta', value: showTa ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('exam_settings').upsert({ key: 'show_toan', value: showToan ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        supabase.from('exam_settings').upsert({ key: 'show_tdkh', value: showTdkh ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      ]);
      setVisibilityStatus({ type: 'success', msg: 'Đã lưu hiển thị các phần thi!' });
      setTimeout(() => setVisibilityStatus(null), 3000);
    } catch (err: any) {
      setVisibilityStatus({ type: 'error', msg: `Lỗi: ${err?.message || 'Không xác định'}` });
    }
    setVisibilitySaving(false);
  };

  const handleSaveSbdMap = () => {
    const map: Record<string, string> = {};
    for (const line of sbdMapStr.split('\n').map(l => l.trim()).filter(l => l)) {
      const parts = line.split(/\t|,/).map(p => p.trim());
      if (parts.length >= 2) map[parts[0]] = parts[1];
    }
    saveSetting('sbd_map', JSON.stringify(map), setSbdMapSaving, setSbdMapStatus, 'Đã lưu danh sách SBD thành công!');
  };

  const handleClearAll = async () => {
    if (!supabase || clearConfirm !== 'all') return;
    setLoading(true);
    setClearStatus(null);
    try {
      const [res1, res2, res3] = await Promise.all([
        supabase.from('student_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
      if (res3.error) throw res3.error;
      setClearStatus({ type: 'success', msg: 'Đã xóa toàn bộ dữ liệu thành công!' });
      await refreshStats();
    } catch (err: any) {
      console.error('Lỗi khi xóa dữ liệu:', err);
      setClearStatus({ type: 'error', msg: `Lỗi khi xóa: ${err?.message || 'Không thể xóa dữ liệu'}` });
    } finally {
      setLoading(false);
      setClearConfirm(false);
    }
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
            <p className="text-sm text-slate-500 mt-1">Đăng nhập để cấu hình kì thi</p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} required autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium transition-all bg-white"
            />
            <input
              type="password" placeholder="Mật khẩu" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
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

      {/* Thống kê — toàn bộ số liệu tự đếm từ database, không nhập tay */}
      {stats && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-700">
              Số liệu tổng quan · {EXAM_LABEL}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<Repeat className="w-5 h-5" />} label="Số lượt thi" value={stats.attempts} note={`nhiều nhất ${stats.maxAttempts} lần / thí sinh`} color="indigo" />
            <StatCard icon={<Users className="w-5 h-5" />} label="Số thí sinh" value={stats.uniqueStudents} note="đếm theo email hoặc tên" color="sky" />
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="Câu hỏi" value={stats.questions} note={`${stats.responses.toLocaleString('vi-VN')} bản ghi câu sai`} color="amber" />
          </div>

          {stats.attemptBreakdown.length > 0 && (
            <div className="card p-4 sm:p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-2">
                Phân bố số lần thi
              </h4>
              <div className="flex flex-wrap gap-2">
                {stats.attemptBreakdown.map(row => (
                  <span
                    key={row.attempts}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                  >
                    {row.students.toLocaleString('vi-VN')} thí sinh · {row.attempts} lần thi
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500 mb-3 border-b pb-2">
              Điểm của lần thi mới nhất trong {EXAM_LABEL.toLowerCase()}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">TB Điểm Toán</p>
                <p className="text-xl font-bold text-indigo-600">{stats.avgToan === null ? '—' : stats.avgToan.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400">thang {subjectMax('tho')}đ</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">TB Điểm TDKH</p>
                <p className="text-xl font-bold text-sky-600">{stats.avgTdkh === null ? '—' : stats.avgTdkh.toFixed(2)}</p>
                <p className="text-[11px] text-slate-400">thang {subjectMax('tho')}đ</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Điểm Giỏi · 4 môn</p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.goodCount}<span className="text-sm font-bold text-slate-400">/{stats.goodTotal}</span>
                </p>
                <p className="text-[11px] text-slate-400">tổng ≥ {GIOI_MIN}/{MAX_ALL_SUBJECT_SCORE}đ</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Câu sai nhiều nhất</p>
                <p className="text-sm font-bold text-rose-600 mt-1 leading-snug">{stats.hardestQ || 'Chưa có'}</p>
                <p className="text-[11px] text-slate-400">theo tỉ lệ sai</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tên kì thi */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-indigo-500" />
          Tên kì thi
        </h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={examName}
            onChange={e => setExamName(e.target.value)}
            placeholder="Ví dụ: Kì Thi Khảo Sát Toán & TDKH - Đợt 3"
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 font-medium transition-all bg-white"
          />
          <StatusLine status={examNameStatus} />
          <SaveButton loading={examNameSaving} onClick={handleSaveExamName} disabled={!examName.trim()} label="Lưu tên kì thi" />
        </div>
      </div>

      {/* Hiển thị các phần thi */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
          <Award className="w-5 h-5 text-indigo-500" />
          Hiển thị các phần thi
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Bỏ chọn môn nào thì môn đó biến mất khỏi trang tra cứu của thí sinh.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {([
            ['Tiếng Việt', showTv, setShowTv],
            ['Tiếng Anh', showTa, setShowTa],
            ['Toán', showToan, setShowToan],
            ['Khoa Học', showTdkh, setShowTdkh],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, checked, onChange]) => (
            <label
              key={label}
              className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl hover:bg-indigo-50/50 transition-colors"
            >
              <input
                type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <StatusLine status={visibilityStatus} />
          <SaveButton loading={visibilitySaving} onClick={handleSaveVisibility} label="Lưu hiển thị" />
        </div>
      </div>

      {/* Link và mã */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-indigo-500" />
          Link và mã
        </h2>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Link đáp án chi tiết (hiển thị cho thí sinh)</label>
            <input
              type="text" value={answerLink} onChange={e => setAnswerLink(e.target.value)}
              placeholder="VD: https://docs.google.com/..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            <StatusLine status={answerLinkStatus} />
            <SaveButton loading={answerLinkSaving} onClick={handleSaveAnswerLink} label="Lưu link đáp án" />
          </div>

          <hr className="border-slate-100" />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Link đến kì thi (sinh mã QR ở trang chủ)</label>
            <input
              type="text" value={examUrl} onChange={e => setExamUrl(e.target.value)}
              placeholder="VD: https://docs.google.com/forms/..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            {examUrl && (
              <div className="flex items-center gap-3 mt-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(examUrl)}`}
                  alt="QR xem trước"
                  className="w-20 h-20 rounded-lg border border-slate-200 bg-white p-1"
                />
                <p className="text-xs text-slate-500">Xem trước mã QR sẽ hiện ở góc dưới bên phải trang tra cứu.</p>
              </div>
            )}
            <StatusLine status={examUrlStatus} />
            <SaveButton loading={examUrlSaving} onClick={handleSaveExamUrl} label="Lưu link kì thi" />
          </div>

          <hr className="border-slate-100" />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Dự kiến đợt thi tiếp theo (văn bản ngắn)</label>
            <input
              type="text" value={nextExamDate} onChange={e => setNextExamDate(e.target.value)}
              placeholder="VD: Chủ Nhật tuần sau, 20h00"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            <StatusLine status={nextExamDateStatus} />
            <SaveButton loading={nextExamDateSaving} onClick={handleSaveNextExamDate} label="Lưu dự kiến đợt thi" />
          </div>
        </div>
      </div>

      {/* SBD */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Danh sách Số Báo Danh (SBD)
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Copy 2 cột từ Excel (Họ Tên và SBD) rồi dán vào đây. Học sinh sẽ thấy mã này cạnh tên khi tra cứu điểm.
        </p>
        <div className="flex flex-col gap-3">
          <textarea
            value={sbdMapStr}
            onChange={e => setSbdMapStr(e.target.value)}
            placeholder={'Nguyễn Văn A\t123456\nTrần Thị B\t654321'}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white h-48 font-mono text-sm"
          />
          <StatusLine status={sbdMapStatus} />
          <SaveButton loading={sbdMapSaving} onClick={handleSaveSbdMap} label="Lưu danh sách SBD" />
        </div>
      </div>

      {/* Vùng nguy hiểm */}
      <div className="card p-5 sm:p-6 border-2 border-rose-100">
        <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2 mb-3">
          <Trash2 className="w-5 h-5" />
          Vùng nguy hiểm
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Xoá toàn bộ dữ liệu thí sinh, câu hỏi và đáp án. Không thể hoàn tác.
        </p>
        {!clearConfirm ? (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setClearConfirm('all')}
              className="px-4 py-2 rounded-lg border-2 border-rose-200 text-rose-600 font-semibold text-sm hover:bg-rose-50 transition-colors"
            >
              Xoá toàn bộ dữ liệu
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-rose-600">
              Xoá toàn bộ dữ liệu?
            </span>
            <button
              onClick={handleClearAll} disabled={loading}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang xoá...' : 'Đồng ý, xoá'}
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors"
            >
              Huỷ
            </button>
          </div>
        )}

        {clearStatus && (
          <div className={`mt-4 flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl ${clearStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {clearStatus.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              : <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />}
            <div>{clearStatus.msg}</div>
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

type Status = { type: 'success' | 'error'; msg: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg w-fit ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {status.type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {status.msg}
    </div>
  );
}

function SaveButton({ loading, onClick, label, disabled }: { loading: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={loading || disabled}
      className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {label}
    </button>
  );
}

function StatCard({
  icon, label, value, note, color,
}: { icon: React.ReactNode; label: string; value: number; note: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-800">{value.toLocaleString('vi-VN')}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>
      </div>
    </div>
  );
}