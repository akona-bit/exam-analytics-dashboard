const fs = require('fs');

const file = 'd:/kết-quả-khảo-sát/Dashboard.tsx';
let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// Remove the searchSbd state
const searchSbdIdx = lines.findIndex(l => l.includes("const [searchSbd, setSearchSbd] = useState('');"));
if (searchSbdIdx !== -1) {
  lines.splice(searchSbdIdx, 1);
}

// Remove the searchResults block
const startSearchResults = lines.findIndex(l => l.includes('const searchResults = useMemo(() => {'));
const endSearchResults = lines.findIndex((l, i) => i > startSearchResults && l.includes('}, [students, searchQuery, searchSbd, sbdMap]);'));

if (startSearchResults !== -1 && endSearchResults !== -1) {
  const newSearchResults = [
    "  const searchResults = useMemo(() => {",
    "    const lowerQuery = searchQuery.toLowerCase().trim();",
    "    if (!lowerQuery) return { type: 'empty', data: [] };",
    "",
    "    const pickLatest = (rows: StudentData[]) => {",
    "      const latestMap = new Map<string, StudentData>();",
    "      for (const m of rows) {",
    "        const key = m.email || m.name;",
    "        const ex = latestMap.get(key);",
    "        if (!ex || m.stt > ex.stt) latestMap.set(key, m);",
    "      }",
    "      return { type: 'success', data: Array.from(latestMap.values()).slice(0, 5) };",
    "    };",
    "",
    "    const matches: StudentData[] = [];",
    "    for (const s of students) {",
    "      const byName = s.name.toLowerCase().includes(lowerQuery)",
    "        || (!!s.email && s.email.toLowerCase().includes(lowerQuery));",
    "      if (byName) {",
    "        matches.push(s);",
    "      }",
    "    }",
    "",
    "    if (matches.length === 0) {",
    "      return { type: 'not_found', data: [] };",
    "    }",
    "",
    "    return pickLatest(matches);",
    "  }, [students, searchQuery]);"
  ];
  
  lines.splice(startSearchResults, endSearchResults - startSearchResults + 1, ...newSearchResults);
}

// Replace handleSearchSubmit
const startSubmit = lines.findIndex(l => l.includes('const handleSearchSubmit = (e: React.FormEvent) => {'));
const endSubmit = lines.findIndex((l, i) => i > startSubmit && l.includes('alert("Không tìm thấy thí sinh nào phù hợp.");')) + 2;

if (startSubmit !== -1 && endSubmit !== -1) {
  const newSubmit = [
    "  const handleSearchSubmit = (e: React.FormEvent) => {",
    "    e.preventDefault();",
    "    if (!searchQuery.trim()) {",
    "      alert(\"Vui lòng nhập Họ và tên hoặc Email để tra cứu.\");",
    "      return;",
    "    }",
    "    ",
    "    if (searchResults.type === 'success' && searchResults.data.length > 0) {",
    "      setSelectedStudent(searchResults.data[0]);",
    "      setSearchQuery('');",
    "    } else {",
    "      alert(\"Không tìm thấy thí sinh nào phù hợp.\");",
    "    }",
    "  };"
  ];
  lines.splice(startSubmit, endSubmit - startSubmit + 1, ...newSubmit);
}

// Update instruction text
const instrIdx = lines.findIndex(l => l.includes('Nhập họ tên và số báo danh bên dưới để tra cứu'));
if (instrIdx !== -1) {
  lines[instrIdx] = lines[instrIdx].replace('Nhập họ tên và số báo danh bên dưới để tra cứu', 'Nhập họ tên hoặc email bên dưới để tra cứu');
}

// Replace Form inputs block
const startForm = lines.findIndex(l => l.includes('<div className="flex flex-col sm:flex-row gap-4 w-full">'));
const endForm = lines.findIndex((l, i) => i > startForm && l.includes('TRA CỨU KẾT QUẢ')) + 2;

if (startForm !== -1 && endForm !== -1) {
  const newForm = [
    "              <div className=\"flex flex-col sm:flex-row gap-4 w-full\">",
    "              ",
    "              {/* Input 1 */}",
    "              <div className=\"flex-1 flex flex-col gap-1.5 relative w-full\">",
    "                <label htmlFor=\"lookup-name\" className=\"pl-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400\">Họ tên hoặc Email</label>",
    "                <div className=\"relative group\">",
    "                  <Search className=\"absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors pointer-events-none\" />",
    "                  <input",
    "                    id=\"lookup-name\"",
    "                    type=\"text\"",
    "                    placeholder=\"Nhập họ tên hoặc email...\"",
    "                    value={searchQuery}",
    "                    onChange={(e) => setSearchQuery(e.target.value)}",
    "                    autoFocus",
    "                    autoComplete=\"off\"",
    "                    className=\"w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium text-base transition-all shadow-sm bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:shadow-md outline-none\"",
    "                  />",
    "                </div>",
    "                ",
    "                {/* Suggestions Dropdown */}",
    "                {searchQuery.trim() && searchResults.type === 'success' && searchResults.data.length > 0 && (",
    "                  <div className=\"absolute top-[100%] mt-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[100]\">",
    "                    {searchResults.data.map((student, idx) => (",
    "                      <button",
    "                        key={idx}",
    "                        type=\"button\"",
    "                        onClick={() => {",
    "                          setSelectedStudent(student);",
    "                          setSearchQuery('');",
    "                        }}",
    "                        className=\"w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 flex items-center justify-between\"",
    "                      >",
    "                        <span className=\"font-semibold text-slate-800 dark:text-slate-200\">{student.name}</span>",
    "                        {student.email && <span className=\"text-sm text-slate-500 dark:text-slate-400\">{maskEmail(student.email)}</span>}",
    "                      </button>",
    "                    ))}",
    "                  </div>",
    "                )}",
    "              </div>",
    "            </div>",
    "",
    "            {/* BUTTON */}",
    "            <button ",
    "              type=\"submit\"",
    "              disabled={!searchQuery.trim()}",
    "              className=\"w-full sm:w-auto sm:mx-auto px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-45 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm sm:text-base tracking-wide flex items-center gap-2 justify-center\"",
    "            >",
    "              <Search className=\"w-5 h-5\" />",
    "              TRA CỨU KẾT QUẢ",
    "            </button>"
  ];
  
  lines.splice(startForm, endForm - startForm + 1, ...newForm);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Done replacement');
