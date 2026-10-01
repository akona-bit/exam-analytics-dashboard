import fs from 'fs';
let content = fs.readFileSync('Dashboard.tsx', 'utf8');

const target = `<input
                  type="text"
                  placeholder="Họ và tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-14 pr-6 py-3.5 sm:py-4 rounded-full border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 dark:text-slate-200 font-medium text-base transition-all shadow-lg bg-white dark:bg-slate-800/95 backdrop-blur-sm hover:shadow-xl focus:shadow-xl outline-none"
                />`;

const replacement = target + `
                {autoCompleteSuggestions.length > 0 && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 text-left">
                    {autoCompleteSuggestions.map((sName, idx) => (
                      <div 
                        key={idx} 
                        className="px-5 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={() => {
                          setSearchQuery(sName);
                        }}
                      >
                        {sName}
                      </div>
                    ))}
                  </div>
                )}`;

if (content.includes('autoCompleteSuggestions.length > 0 && !selectedStudent')) {
  console.log("Autocomplete already exists in UI.");
} else {
  // Try CRLF
  let replaced = content.replace(target, replacement);
  if (replaced === content) {
    console.log("Could not find exact target. Using regex.");
    // replace using a regex that ignores whitespace differences
    const targetRegex = /placeholder="Họ và tên\.\.\."[\s\S]*?outline-none"\s*\/>/;
    replaced = content.replace(targetRegex, match => match + `\n                {autoCompleteSuggestions.length > 0 && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 text-left">
                    {autoCompleteSuggestions.map((sName, idx) => (
                      <div 
                        key={idx} 
                        className="px-5 py-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={() => {
                          setSearchQuery(sName);
                        }}
                      >
                        {sName}
                      </div>
                    ))}
                  </div>
                )}`);
  }
  fs.writeFileSync('Dashboard.tsx', replaced);
  console.log("Autocomplete added!");
}
