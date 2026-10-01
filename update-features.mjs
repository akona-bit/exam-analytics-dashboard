import fs from 'fs';

// 1. Update AdminPage.tsx
let adminPage = fs.readFileSync('AdminPage.tsx', 'utf8');

// State
adminPage = adminPage.replace(
  `const [nextExamDateStatus, setNextExamDateStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);`,
  `const [nextExamDateStatus, setNextExamDateStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [examUrl, setExamUrl] = useState('');
  const [examUrlSaving, setExamUrlSaving] = useState(false);
  const [examUrlStatus, setExamUrlStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);`
);

// Fetching
adminPage = adminPage.replace(
  `if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);`,
  `if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'exam_url' && row.value) setExamUrl(row.value);`
);

// Save Handler
const saveHandlerStr = `const handleSaveNextExamDate = async () => {`;
const saveUrlHandler = `const handleSaveExamUrl = async () => {
    if (!supabase) return;
    setExamUrlSaving(true);
    setExamUrlStatus(null);
    try {
      const { error } = await supabase.from('exam_settings').upsert(
        { key: 'exam_url', value: examUrl.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setExamUrlStatus({ type: 'success', msg: 'Đã lưu link mã QR thành công!' });
      setTimeout(() => setExamUrlStatus(null), 3000);
    } catch (err: any) {
      setExamUrlStatus({ type: 'error', msg: \`Lỗi: \${err?.message || 'Không xác định'}\` });
    }
    setExamUrlSaving(false);
  };

  `;
adminPage = adminPage.replace(saveHandlerStr, saveUrlHandler + saveHandlerStr);

// UI Block
const nextExamBlockStr = `<button
              onClick={handleSaveNextExamDate}
              disabled={nextExamDateSaving}
              className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2 mt-1"
            >
              {nextExamDateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu dự kiến đợt thi
            </button>
          </div>`;
const examUrlBlockStr = `
          <hr className="border-slate-100" />

          {/* Exam URL / QR Code */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">Link đến kì thi (để tạo QR ở trang chủ)</label>
            <input
              type="text"
              value={examUrl}
              onChange={e => setExamUrl(e.target.value)}
              placeholder="VD: https://docs.google.com/forms/..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-slate-700 transition-all bg-white"
            />
            {examUrlStatus && (
              <div className={\`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg mt-1 w-fit \${examUrlStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>
                {examUrlStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {examUrlStatus.msg}
              </div>
            )}
            <button
              onClick={handleSaveExamUrl}
              disabled={examUrlSaving}
              className="w-fit px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2 mt-1"
            >
              {examUrlSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu link kì thi
            </button>
          </div>`;
adminPage = adminPage.replace(nextExamBlockStr, nextExamBlockStr + examUrlBlockStr);
fs.writeFileSync('AdminPage.tsx', adminPage);


// 2. Update App.tsx
let appStr = fs.readFileSync('App.tsx', 'utf8');

// State
appStr = appStr.replace(
  `const [nextExamDate, setNextExamDate] = useState('');`,
  `const [nextExamDate, setNextExamDate] = useState('');
  const [examUrl, setExamUrl] = useState('');`
);

// Fetching
appStr = appStr.replace(
  `if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);`,
  `if (row.key === 'next_exam_date' && row.value) setNextExamDate(row.value);
        if (row.key === 'exam_url' && row.value) setExamUrl(row.value);`
);

// Discord Link in App.tsx
const oldDiscordApp = `Nếu có bất kì lỗi gì về trang web, hãy liên hệ qua Discord: <a href="https://discordapp.com/users/734403880208564235" target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors">https://discordapp.com/users/734403880208564235</a>`;
const newDiscordApp = `Nếu có bất kì lỗi gì về trang web, hãy liên hệ qua <a href="https://discordapp.com/users/734403880208564235" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center translate-y-1.5 ml-2 hover:scale-110 transition-transform"><img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="h-6 w-auto" /></a>`;
appStr = appStr.replace(oldDiscordApp, newDiscordApp);

// Login Button and QR Code
const oldLoginBtn = `{/* Hidden admin access button */}
      <button
        onClick={() => { window.location.hash = '#admin'; }}
        className="fixed bottom-3 right-3 w-3 h-3 rounded-full bg-slate-400 opacity-[0.05] hover:opacity-[0.15] transition-opacity cursor-default z-10"
        aria-hidden="true"
        tabIndex={-1}
      />`;
const newLoginBtnAndQr = `{/* Floating Admin Login Button */}
      <button
        onClick={() => { window.location.hash = '#admin'; }}
        className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-indigo-600 border border-indigo-100 shadow-sm hover:bg-indigo-50 hover:shadow transition-all flex items-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Đăng nhập
      </button>

      {/* Floating QR Code */}
      {examUrl && !isAdmin && (
        <a href={examUrl} target="_blank" rel="noopener noreferrer" className="fixed bottom-4 right-4 z-40 bg-white p-2.5 rounded-2xl shadow-xl border-2 border-indigo-100 flex flex-col items-center gap-1.5 hover:scale-105 hover:-translate-y-1 transition-all origin-bottom-right group cursor-pointer">
          <p className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-wide group-hover:text-indigo-700">Mã làm bài thi</p>
          <img src={\`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=\${encodeURIComponent(examUrl)}\`} alt="QR Code" className="w-[80px] h-[80px] sm:w-[120px] sm:h-[120px]" />
        </a>
      )}`;
appStr = appStr.replace(oldLoginBtn, newLoginBtnAndQr);

fs.writeFileSync('App.tsx', appStr);

// 3. Update Dashboard.tsx
let dashboardStr = fs.readFileSync('Dashboard.tsx', 'utf8');

const oldDiscordDash = `<a 
          href="https://discordapp.com/users/734403880208564235" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto text-center"
        >
          Liên hệ Discord
        </a>`;
const newDiscordDash = `<a 
          href="https://discordapp.com/users/734403880208564235" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap w-full sm:w-auto text-center flex items-center justify-center gap-2 shadow-sm"
        >
          <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6cc3c481a15a141738_icon_clyde_white_RGB.png" alt="Discord" className="w-5 h-5 object-contain" />
          Liên hệ Discord
        </a>`;
dashboardStr = dashboardStr.replace(oldDiscordDash, newDiscordDash);

fs.writeFileSync('Dashboard.tsx', dashboardStr);
