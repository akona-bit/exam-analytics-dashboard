import fs from 'fs';

const files = [
  'Dashboard.tsx', 
  'KnowledgeMatrix.tsx', 
  'AbilityDistribution.tsx', 
  'ClassAnalytics.tsx', 
  'App.tsx'
];

const replacements = [
  ['bg-white', 'bg-white dark:bg-slate-800'],
  ['text-slate-800', 'text-slate-800 dark:text-slate-100'],
  ['text-slate-700', 'text-slate-700 dark:text-slate-200'],
  ['text-slate-600', 'text-slate-600 dark:text-slate-300'],
  ['text-slate-500', 'text-slate-500 dark:text-slate-400'],
  ['text-slate-400', 'text-slate-400 dark:text-slate-500'],
  ['bg-slate-50', 'bg-slate-50 dark:bg-slate-900/50'],
  ['bg-slate-100', 'bg-slate-100 dark:bg-slate-800'],
  ['bg-[#f8fafc]', 'bg-[#f8fafc] dark:bg-slate-900'],
  ['border-slate-100', 'border-slate-100 dark:border-slate-700/50'],
  ['border-slate-200', 'border-slate-200 dark:border-slate-700'],
  ['divide-slate-200', 'divide-slate-200 dark:divide-slate-700'],
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [find, replace] of replacements) {
      // Prevent double replacements (e.g., if "dark:bg-slate-800" is already there)
      content = content.replaceAll(replace, find); // first remove any existing replacements
      content = content.replaceAll(find, replace);
    }
    fs.writeFileSync(file, content);
  }
}

// Add Dark Mode Toggle to App.tsx
let appStr = fs.readFileSync('App.tsx', 'utf8');
if (!appStr.includes('const [isDark, setIsDark]')) {
  const toggleImport = `import { Moon, Sun } from 'lucide-react';\n`;
  appStr = toggleImport + appStr;
  
  const hooksEnd = `const [sbdMap, setSbdMap] = useState<Record<string, string>>({});`;
  const darkHooks = `
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);
`;
  appStr = appStr.replace(hooksEnd, hooksEnd + darkHooks);
  
  const mainDiv = `<div className="min-h-[100dvh] w-screen bg-[#f8fafc] dark:bg-slate-900">`;
  const mainDivWithToggle = `<div className="min-h-[100dvh] w-screen bg-[#f8fafc] dark:bg-slate-900 transition-colors duration-300">
        <button onClick={() => setIsDark(!isDark)} className="fixed top-4 left-4 z-50 p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-700 dark:text-slate-200 hover:scale-110 transition-all">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>`;
  
  // Actually, wait, App.tsx has multiple return paths (admin, error, loading, Dashboard). Let's just put it in a fixed positioned button inside Dashboard or App wrapper.
  appStr = appStr.replace(mainDiv, mainDivWithToggle);
  
  // Wait, I should also replace the Dashboard render wrapper if it's separate.
  const dashboardRender = `<div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-slate-900 font-sans">`;
  const dashboardRenderWithToggle = `<div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-slate-900 font-sans transition-colors duration-300">
        <button onClick={() => setIsDark(!isDark)} className="fixed top-4 left-4 z-50 p-2.5 rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-700 dark:text-slate-200 hover:scale-110 transition-all">
          {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
        </button>`;
  appStr = appStr.replace(dashboardRender, dashboardRenderWithToggle);
  
  fs.writeFileSync('App.tsx', appStr);
}

// Add dark mode support to tailwind (in index.html or tailwind css)
// Tailwind v4 uses CSS variables or media queries. Since we want a toggle class, we might need to configure Tailwind.
// Actually, Tailwind 3/4 `dark:` variants work automatically with media query by default, but if we want class-based `dark:`, we need to add `darkMode: 'class'` to tailwind config.
// Or in Tailwind CSS v4, we use `@variant dark (&:where(.dark, .dark *));` in CSS.
// Let's add that to index.css
let cssStr = fs.readFileSync('index.css', 'utf8');
if (!cssStr.includes('@custom-variant dark')) {
  cssStr = `@custom-variant dark (&:where(.dark, .dark *));\n` + cssStr;
  fs.writeFileSync('index.css', cssStr);
}

console.log("Dark mode classes and toggle added successfully.");
