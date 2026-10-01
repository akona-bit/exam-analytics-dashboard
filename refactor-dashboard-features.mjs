import fs from 'fs';

let dashStr = fs.readFileSync('Dashboard.tsx', 'utf8');

// 1. Update Recharts Imports
dashStr = dashStr.replace(
  `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';`,
  `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';`
);
if(!dashStr.includes('PolarGrid')) {
  dashStr = dashStr.replace(
    `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';`,
    `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';`
  ); // fallback in case it was slightly different
}
// 2. Radar Data Logic
const chartDataLogic = `
  const chartData = useMemo(() => {
    if (!selectedStudent) return [];
    const s = selectedStudent;
    return [
      { name: 'Điểm Thô', Toán: s.tho.toan || 0, TDKH: s.tho.tdkh || 0 },
      { name: 'Điểm IRT', Toán: s.irt.toan || 0, TDKH: s.irt.tdkh || 0 },
      { name: 'Thưởng Phạt', Toán: s.thuongPhat.toan || 0, TDKH: s.thuongPhat.tdkh || 0 },
    ];
  }, [selectedStudent]);
`;
const newChartDataLogic = chartDataLogic + `
  const radarData = useMemo(() => {
    if (!selectedStudent || !selectedStudent.responses) return [];
    
    // Macro skills definitions (total questions per skill)
    const skills = [
      { name: 'Toán học', range: [1, 30], total: 30 },
      { name: 'Logic', range: [31, 38], total: 8 },
      { name: 'PT Số liệu', range: [39, 50], total: 12 },
      { name: 'KHTN', range: [51, 56], total: 6 },
      { name: 'KHXH', range: [57, 60], total: 4 }
    ];
    
    return skills.map(skill => {
      // Find how many they got wrong/missing in this range
      const wrongOrMissing = selectedStudent.responses!.filter(r => 
        r.question_num >= skill.range[0] && r.question_num <= skill.range[1]
      ).length;
      
      const correct = skill.total - wrongOrMissing;
      const percent = Math.round((correct / skill.total) * 100);
      
      return {
        subject: skill.name,
        'Độ hoàn thiện (%)': percent,
        fullMark: 100
      };
    });
  }, [selectedStudent]);
`;
dashStr = dashStr.replace(chartDataLogic, newChartDataLogic);

// 3. Replace BarChart with RadarChart
const barChartJSX = `
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{fill: '#f8fafc'}} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Bar dataKey="Toán" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="TDKH" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
`;
const radarChartJSX = `
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4f46e5', fontSize: 12, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Radar name="Kỹ năng" dataKey="Độ hoàn thiện (%)" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.5} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
`;
dashStr = dashStr.replace(barChartJSX, radarChartJSX);

// Also change the title of the card from "Cấu trúc điểm" to "Phân tích Năng lực (Radar)"
dashStr = dashStr.replace(
  `<h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                <BarChartIcon className="text-indigo-500 w-6 h-6" />
                Cấu trúc điểm
              </h2>`,
  `<h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                <Target className="text-indigo-500 w-6 h-6" />
                Phân tích Năng lực
              </h2>`
);

// 4. Add Leaderboard
// In the search form area, right below the form:
const formEnd = `</form>`;
const leaderboardJSX = `</form>
          {/* Leaderboard */}
          <div className="w-full max-w-2xl mt-12 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-indigo-100 dark:border-slate-700 overflow-hidden fade-in" style={{animationDelay: '0.2s'}}>
            <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-300" />
                Bảng Vàng Vinh Danh - Top 10 IRT
              </h3>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-bold">Hạng</th>
                    <th className="px-6 py-3 font-bold">Thí sinh</th>
                    <th className="px-6 py-3 font-bold text-right">Điểm IRT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rankData.irt.slice(0, 10).map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {/* Mask name: Nguyen Van A -> Nguyen V** A */}
                        {s.name.split(' ').map((word, i, arr) => i === arr.length - 2 && word.length > 1 ? word[0] + '*'.repeat(word.length - 1) : word).join(' ')}
                      </td>
                      <td className="px-6 py-3 font-bold text-indigo-600 dark:text-indigo-400 text-right">
                        {s.totalIrt.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
`;
dashStr = dashStr.replace(formEnd, leaderboardJSX);

fs.writeFileSync('Dashboard.tsx', dashStr);
console.log("Dashboard Radar Chart and Leaderboard added.");
