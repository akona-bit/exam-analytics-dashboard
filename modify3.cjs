const fs = require('fs');
const file = 'd:/kết-quả-khảo-sát/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove searchSbd
content = content.replace(/const \[searchSbd, setSearchSbd\] = useState\(''\);\r?\n\s*/g, '');

// 2. Replace searchResults
const searchResultsRegex = /const searchResults = useMemo\(\(\) => \{[\s\S]*?\}, \[students, searchQuery, searchSbd, sbdMap\]\);/g;
const newSearchResults = `const searchResults = useMemo(() => {
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
    for (const s of students) {
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
  }, [students, searchQuery]);`;
content = content.replace(searchResultsRegex, newSearchResults);

// 3. Replace handleSearchSubmit
const submitRegex = /const handleSearchSubmit = \(e: React\.FormEvent\) => \{[\s\S]*?alert\("Không tìm thấy thí sinh nào phù hợp\."\);\r?\n\s*\}\r?\n\s*\};/g;
const newSubmit = `const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      alert("Vui lòng nhập Họ và tên hoặc Email để tra cứu.");
      return;
    }
    
    if (searchResults.type === 'success' && searchResults.data.length > 0) {
      setSelectedStudent(searchResults.data[0]);
      setSearchQuery('');
    } else {
      alert("Không tìm thấy thí sinh nào phù hợp.");
    }
  };`;
content = content.replace(submitRegex, newSubmit);

// 4. Update hint text
content = content.replace('Nhập họ tên và số báo danh bên dưới để tra cứu', 'Nhập họ tên hoặc email bên dưới để tra cứu');

// 5. Replace Form content inside <form> ... </form>
const formRegex = /<form onSubmit=\{handleSearchSubmit\} className="relative w-full max-w-2xl px-2 flex flex-col items-center gap-6">[\s\S]*?<\/form>/g;
const newForm = `<form onSubmit={handleSearchSubmit} className="relative w-full max-w-2xl px-2 flex flex-col items-center gap-6">
            <div className="w-full rounded-[28px] border border-white/70 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgba(15,23,42,0.55)] p-5 sm:p-7 flex flex-col gap-5 fade-in">
              <div className="flex flex-col sm:flex-row gap-4 w-full">
              
              {/* Input 1 */}
              <div className="flex-1 flex flex-col gap-1.5 relative w-full">
                <label htmlFor="lookup-name" className="pl-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Họ tên hoặc Email</label>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <input
                    id="lookup-name"
                    type="text"
                    placeholder="Nhập họ tên hoặc email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium text-base transition-all shadow-sm bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:shadow-md outline-none"
                  />
                </div>
                
                {/* Suggestions Dropdown */}
                {searchQuery.trim() && searchResults.type === 'success' && searchResults.data.length > 0 && (
                  <div className="absolute top-[100%] mt-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[100]">
                    {searchResults.data.map((student, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(student);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{student.name}</span>
                        {student.email && <span className="text-sm text-slate-500 dark:text-slate-400">{maskEmail(student.email)}</span>}
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
              className="w-full sm:w-auto sm:mx-auto px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-45 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm sm:text-base tracking-wide flex items-center gap-2 justify-center"
            >
              <Search className="w-5 h-5" />
              TRA CỨU KẾT QUẢ
            </button>
            </div>
          </form>`;
content = content.replace(formRegex, newForm);

fs.writeFileSync(file, content);
console.log('Done replacement');
