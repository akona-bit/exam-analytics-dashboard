import fs from 'fs';

let dashStr = fs.readFileSync('Dashboard.tsx', 'utf8');

// 1. ADD PDF EXPORT IMPORTS
const importsToInject = `import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';
`;
dashStr = dashStr.replace(`import { CelebrationOverlay }`, importsToInject + `import { CelebrationOverlay }`);

// 2. ADD AUTOCOMPLETE AND RANK LOGIC inside Dashboard component
const stateHooksEnd = `const celebratedRef = React.useRef<Set<string>>(new Set());`;
const newHooks = `
  const autoCompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const lowerName = searchQuery.toLowerCase();
    const nameMatches = students.filter(s => s.name.toLowerCase().includes(lowerName) || (s.email && s.email.toLowerCase().includes(lowerName)));
    // Get unique names
    const uniqueNames = new Set<string>();
    const suggestions: string[] = [];
    for (const m of nameMatches) {
      if (!uniqueNames.has(m.name)) {
        uniqueNames.add(m.name);
        suggestions.push(m.name);
      }
    }
    return suggestions.slice(0, 5);
  }, [searchQuery, students]);

  const studentRankInfo = useMemo(() => {
    if (!selectedStudent) return null;
    const latestStudents = new Map<string, StudentData>();
    students.forEach(s => {
      const key = s.name;
      const ex = latestStudents.get(key);
      if (!ex || s.stt > ex.stt) latestStudents.set(key, s);
    });
    const allLatest = Array.from(latestStudents.values());
    const totalScore = (s: StudentData) => (s.tho.toan || 0) + (s.tho.tdkh || 0);
    allLatest.sort((a, b) => totalScore(b) - totalScore(a));
    const rank = allLatest.findIndex(s => s.name === selectedStudent.name) + 1;
    const total = allLatest.length;
    const percentile = total > 1 ? (((total - rank) / total) * 100).toFixed(1) : "100";
    return { rank, total, percentile };
  }, [selectedStudent, students]);

  const handleDownloadPDF = async () => {
    const dashboardElement = document.getElementById('dashboard-content');
    if (!dashboardElement) return;
    
    try {
      const canvas = await html2canvas(dashboardElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(\`Phieu_Diem_\${selectedStudent?.name.replace(/\\s+/g, '_')}.pdf\`);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Đã có lỗi xảy ra khi tạo PDF. Vui lòng thử lại.');
    }
  };
`;
dashStr = dashStr.replace(stateHooksEnd, stateHooksEnd + '\n' + newHooks);

// 3. RENDER AUTOCOMPLETE UI
const input1Str = `<input
                  type="text"
                  placeholder="Họ và tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-14 pr-6 py-3.5 sm:py-4 rounded-full border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 font-medium text-base transition-all shadow-md bg-white hover:shadow-lg focus:shadow-lg outline-none"
                />`;
const input1WithAutocomplete = input1Str + `
                {autoCompleteSuggestions.length > 0 && !selectedStudent && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 text-left">
                    {autoCompleteSuggestions.map((sName, idx) => (
                      <div 
                        key={idx} 
                        className="px-5 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 font-medium text-slate-700 hover:text-blue-600 transition-colors"
                        onClick={() => setSearchQuery(sName)}
                      >
                        {sName}
                      </div>
                    ))}
                  </div>
                )}
`;
dashStr = dashStr.replace(input1Str, input1WithAutocomplete);


// 4. RENDER RANK MOTIVATION IN OVERVIEW
const overviewHeaderStr = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-500" />
                  Phần 1: Tổng Quan Kết Quả
                </h2>
                <p className="text-sm text-slate-500 mt-1">Đánh giá chung về năng lực và tỉ lệ hoàn thành bài thi.</p>
              </div>`;

const motivationHtml = `
              {studentRankInfo && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md">
                  <p className="font-bold text-lg">🎉 Chúc mừng! Bạn đang xếp thứ {studentRankInfo.rank}/{studentRankInfo.total}</p>
                  <p className="text-emerald-50 text-sm mt-1">Điểm của bạn cao hơn <strong>{studentRankInfo.percentile}%</strong> các bạn cùng tham gia khảo sát.</p>
                </div>
              )}
`;
dashStr = dashStr.replace(overviewHeaderStr, overviewHeaderStr + motivationHtml);

// 5. RENDER PDF DOWNLOAD BUTTON
const headerSection = `return (
      <div className="w-full max-w-6xl mx-auto pb-12 fade-in relative" id="dashboard-content">`;
const headerSectionWithBtn = `return (
      <div className="w-full max-w-6xl mx-auto pb-12 fade-in relative" id="dashboard-content">
        <div className="flex justify-end mb-4 px-2">
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 font-bold rounded-full shadow-sm hover:shadow-md border border-indigo-100 hover:bg-indigo-50 transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Tải Phiếu Điểm PDF
          </button>
        </div>`;
dashStr = dashStr.replace(headerSection, headerSectionWithBtn);

fs.writeFileSync('Dashboard.tsx', dashStr);

// 6. UPDATE INDEX.HTML FOR SEO
let htmlStr = fs.readFileSync('index.html', 'utf8');
const ogImage = `<meta property="og:image" content="/bg.jpg" />`;
if (!htmlStr.includes('og:image')) {
  htmlStr = htmlStr.replace(`<meta property="og:type"`, ogImage + `\n    <meta property="og:type"`);
  fs.writeFileSync('index.html', htmlStr);
}

console.log("Refactored Dashboard and index.html successfully!");
