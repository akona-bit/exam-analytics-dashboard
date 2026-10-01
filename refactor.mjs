import fs from 'fs';

let content = fs.readFileSync('Dashboard.tsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';",
  "import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';"
);
content = content.replace(
  "import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key } from 'lucide-react';",
  "import { Search, BarChart as BarChartIcon, X, TrendingUp, ChevronLeft, ChevronDown, AlertCircle, BookOpen, FileSpreadsheet, Key, Target, PieChart as PieChartIcon } from 'lucide-react';"
);

// 2. Phần 1 Wrapper
content = content.replace(
  '{/* Single Student Profile */}\n      <section className="card p-4 sm:p-5 md:p-8 border-2 border-indigo-100 bg-white shadow-sm relative overflow-hidden">',
  `{/* Single Student Profile Wrapper */}
      <div className="flex flex-col gap-6 sm:gap-8">
        
        {/* Phần 1: Tổng Quan Kết Quả */}
        <section className="card p-4 sm:p-5 md:p-8 border-2 border-indigo-100 bg-white shadow-sm relative overflow-hidden">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="icon-box bg-indigo-50 text-indigo-600"><Target className="w-5 h-5" /></span>
            Phần 1: Tổng Quan Kết Quả
          </h2>`
);

// 3. Phần 1 - Charts Grid
const oldAbilityChartStart = `{/* Student Ability Chart */}
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5">`;
const newAbilityChartStart = `{/* Ability and Completion Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
          
          {/* Completion Pie Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5 flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-indigo-500" />
              Tỉ Lệ Hoàn Thành Bài Thi
            </h3>
            <div className="flex-1 min-h-[250px] sm:min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const wrong = selectedStudent.responses?.filter(r => r.status === 'wrong').length ?? 0;
                  const missing = selectedStudent.responses?.filter(r => r.status === 'missing').length ?? 0;
                  const correct = questions.length - wrong - missing;
                  const data = [
                    { name: 'Đúng', value: correct, color: '#10b981' },
                    { name: 'Sai', value: wrong, color: '#f43f5e' },
                    { name: 'Bỏ trống', value: missing, color: '#f59e0b' }
                  ].filter(d => d.value > 0);
                  
                  return (
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => \`\${name} \${(percent * 100).toFixed(0)}%\`}
                        labelLine={false}
                      >
                        {data.map((entry, index) => (
                          <Cell key={\`cell-\${index}\`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value) => [\`\${value} câu\`, 'Số lượng']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Student Ability Chart */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5 flex flex-col">`;
content = content.replace(oldAbilityChartStart, newAbilityChartStart);

const oldAbilityChartEnd = `</BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">`;
const diemSoChartStr = `
        {/* Điểm Số Thí Sinh */}
        <div className="mt-6 sm:mt-8 bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5">
          <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 mb-4">
            <BarChartIcon className="w-5 h-5 text-indigo-500" />
            Điểm Số Thí Sinh
          </h3>
          <div className="h-[250px] sm:h-[300px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                <Bar dataKey="Toán" fill="#6366f1" radius={[6,6,0,0]} maxBarSize={50} />
                <Bar dataKey="TDKH" fill="#0ea5e9" radius={[6,6,0,0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>`;
const newAbilityChartEnd = `</BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        ${diemSoChartStr}
        </section>

        {/* Phần 2: Phân Tích Điểm Yếu & Ôn Tập */}
        <section className="card p-4 sm:p-5 md:p-8 bg-white shadow-sm relative overflow-hidden border border-slate-100">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
            <span className="icon-box bg-rose-50 text-rose-500"><AlertCircle className="w-5 h-5" /></span>
            Phần 2: Phân Tích Điểm Yếu & Ôn Tập
          </h2>
          
          {/* Error Distribution Pie Chart */}
          <div className="mb-6 sm:mb-8 bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-5">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-rose-500" />
              Phân Bố Lỗi Sai Theo Môn Học
            </h3>
            <div className="h-[250px] w-full max-w-md mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                {(() => {
                  const wrongToan = selectedStudent.responses?.filter(r => r.status === 'wrong' && questions.find(q => q.id === \`Câu \${r.question_num}\`)?.subject === 'Toán').length ?? 0;
                  const wrongTDKH = selectedStudent.responses?.filter(r => r.status === 'wrong' && questions.find(q => q.id === \`Câu \${r.question_num}\`)?.subject === 'TDKH').length ?? 0;
                  
                  if (wrongToan === 0 && wrongTDKH === 0) {
                    return <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">Không có lỗi sai để phân tích</div>;
                  }
                  
                  const data = [
                    { name: 'Sai môn Toán', value: wrongToan, color: '#6366f1' },
                    { name: 'Sai môn TDKH', value: wrongTDKH, color: '#0ea5e9' }
                  ].filter(d => d.value > 0);
                  
                  return (
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => \`\${name} \${(percent * 100).toFixed(0)}%\`}
                        labelLine={false}
                      >
                        {data.map((entry, index) => (
                          <Cell key={\`cell-\${index}\`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(value) => [\`\${value} câu sai\`, 'Số lượng']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  );
                })()}
              </ResponsiveContainer>
            </div>
          </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">`;
content = content.replace(oldAbilityChartEnd, newAbilityChartEnd);

const oldChartsStart = `{/* Charts */}
      <div className={\`grid grid-cols-1 gap-4 sm:gap-5 md:gap-6 \${studentHistory.length > 1 ? 'lg:grid-cols-2' : ''}\`}>
        <section className="card p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="icon-box bg-indigo-50 text-indigo-600"><BarChartIcon className="w-[18px] h-[18px]" /></span>
            Điểm Số Thí Sinh
          </h2>
          <div className="h-[260px] sm:h-[300px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                <Bar dataKey="Toán" fill="#6366f1" radius={[6,6,0,0]} maxBarSize={50} />
                <Bar dataKey="TDKH" fill="#0ea5e9" radius={[6,6,0,0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {studentHistory.length > 1 && (
        <section className="card p-4 sm:p-5">`;
const newChartsStart = `
      {/* Phần 3: Theo Dõi Tiến Độ */}
      {studentHistory.length > 1 && (
      <section className="card p-4 sm:p-5 md:p-8 bg-white shadow-sm relative overflow-hidden border border-slate-100">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
          <span className="icon-box bg-emerald-50 text-emerald-600"><TrendingUp className="w-5 h-5" /></span>
          Phần 3: Theo Dõi Tiến Độ
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div>
        <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100">`;
content = content.replace(oldChartsStart, newChartsStart);

const oldHistoryTableStart = `</AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        )}
      </div>
      
      {studentHistory.length > 1 && (
        <section className="card overflow-hidden mt-4 sm:mt-5 md:mt-6">`;
const newHistoryTableStart = `</AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
          </div>
          
          <div className="overflow-hidden bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">`;
content = content.replace(oldHistoryTableStart, newHistoryTableStart);

const oldHistoryTableEnd = `</tbody>
            </table>
          </div>
        </section>
      )}`;
const newHistoryTableEnd = `</tbody>
            </table>
          </div>
          </div>
        </div>
      </section>
      )}
      
      </div> {/* End Single Student Profile Wrapper */}`;
content = content.replace(oldHistoryTableEnd, newHistoryTableEnd);

const oldFullAnalytics = `{/* Full Analytics — moved inside student view */}
      <div className="mt-8 flex flex-col gap-8 sm:gap-10">`;
const newFullAnalytics = `{/* Phần 4: Dữ Liệu Toàn Kỳ Thi */}
      <div className="mt-16 pt-10 border-t-[3px] border-dashed border-slate-200 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-400/80 uppercase tracking-widest text-center whitespace-nowrap">Dữ Liệu Toàn Kỳ Thi</h2>
        </div>
        <div className="mb-8 text-center px-4">
           <h3 className="text-2xl sm:text-3xl font-black text-slate-800">Tham Khảo Phổ Điểm & Thống Kê</h3>
           <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-2xl mx-auto">Dữ liệu tổng quan của tất cả thí sinh tham gia trong đợt thi này, giúp bạn có cái nhìn toàn diện hơn về độ khó và mặt bằng chung.</p>
        </div>
        <div className="flex flex-col gap-8 sm:gap-10">`;
content = content.replace(oldFullAnalytics, newFullAnalytics);

fs.writeFileSync('Dashboard.tsx', content);
