import fs from 'fs';

let adminStr = fs.readFileSync('AdminPage.tsx', 'utf8');

// 1. EXTEND STATS INTERFACE
const statsInterface = `const [stats, setStats] = useState<{ students: number; questions: number; responses: number } | null>(null);`;
const extendedStatsInterface = `const [stats, setStats] = useState<{ students: number; questions: number; responses: number; avgToan?: number; avgTdkh?: number; highScores?: number; hardestQ?: string } | null>(null);`;
adminStr = adminStr.replace(statsInterface, extendedStatsInterface);

// 2. EXTEND fetchStats LOGIC
const fetchStatsFunc = `async function fetchStats() {
  if (!supabase) return null;
  const [{ count: studentCount }, { count: questionCount }, { count: responseCount }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('student_responses').select('*', { count: 'exact', head: true }),
  ]);
  return { students: studentCount ?? 0, questions: questionCount ?? 0, responses: responseCount ?? 0 };
}`;

const newFetchStatsFunc = `async function fetchStats() {
  if (!supabase) return null;
  const [{ count: studentCount }, { count: questionCount }, { count: responseCount }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('student_responses').select('*', { count: 'exact', head: true }),
  ]);
  
  // Advanced Stats
  let avgToan = 0, avgTdkh = 0, highScores = 0, hardestQ = '';
  try {
    const { data: studentsData } = await supabase.from('students').select('tho_toan, tho_tdkh');
    if (studentsData && studentsData.length > 0) {
      let sumT = 0, sumD = 0;
      studentsData.forEach(s => {
        sumT += s.tho_toan || 0;
        sumD += s.tho_tdkh || 0;
        if ((s.tho_toan || 0) + (s.tho_tdkh || 0) >= 80) highScores++; // Assume 80 is high score
      });
      avgToan = sumT / studentsData.length;
      avgTdkh = sumD / studentsData.length;
    }
    
    const { data: questionsData } = await supabase.from('questions').select('question_id, incorrect').order('incorrect', { ascending: false }).limit(1);
    if (questionsData && questionsData.length > 0) {
      hardestQ = \`\${questionsData[0].question_id} (\${questionsData[0].incorrect} bạn sai)\`;
    }
  } catch {}

  return { 
    students: studentCount ?? 0, 
    questions: questionCount ?? 0, 
    responses: responseCount ?? 0,
    avgToan: avgToan,
    avgTdkh: avgTdkh,
    highScores: highScores,
    hardestQ: hardestQ
  };
}`;
adminStr = adminStr.replace(fetchStatsFunc, newFetchStatsFunc);

// 3. EXTEND STATS UI
const statsUI = `{/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Học sinh" value={stats.students} color="indigo" />
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Câu hỏi" value={stats.questions} color="sky" />
          <StatCard icon={<FileSpreadsheet className="w-5 h-5" />} label="Bản ghi câu sai" value={stats.responses} color="amber" />
        </div>
      )}`;

const extendedStatsUI = `{/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          <StatCard icon={<Users className="w-5 h-5" />} label="Học sinh" value={stats.students} color="indigo" />
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Câu hỏi" value={stats.questions} color="sky" />
          <StatCard icon={<FileSpreadsheet className="w-5 h-5" />} label="Bản ghi câu sai" value={stats.responses} color="amber" />
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:col-span-3">
            <h3 className="text-sm font-bold text-slate-700 mb-3 border-b pb-2">Thống kê nâng cao đợt thi này</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">TB Điểm Toán</p>
                <p className="text-xl font-bold text-indigo-600">{stats.avgToan?.toFixed(1) || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">TB Điểm TDKH</p>
                <p className="text-xl font-bold text-sky-600">{stats.avgTdkh?.toFixed(1) || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Điểm Giỏi (≥80đ)</p>
                <p className="text-xl font-bold text-emerald-600">{stats.highScores || 0} bạn</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Câu sai nhiều nhất</p>
                <p className="text-sm font-bold text-rose-600 mt-1">{stats.hardestQ || 'Chưa có'}</p>
              </div>
            </div>
          </div>
        </div>
      )}`;
adminStr = adminStr.replace(statsUI, extendedStatsUI);

fs.writeFileSync('AdminPage.tsx', adminStr);
console.log("AdminPage advanced stats refactored successfully.");
