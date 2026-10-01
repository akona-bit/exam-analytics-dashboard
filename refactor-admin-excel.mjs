import fs from 'fs';

let adminStr = fs.readFileSync('AdminPage.tsx', 'utf8');

// Add import for xlsx
if (!adminStr.includes('import * as XLSX from')) {
  adminStr = adminStr.replace(`import {`, `import * as XLSX from 'xlsx';\nimport {`);
}
// Add import for Download icon if not present
if (!adminStr.includes('Download,')) {
  adminStr = adminStr.replace(`Upload, LogOut`, `Upload, LogOut, Download`);
}

// Add handleExport function
const hooksEnd = `const [questionsFile, setQuestionsFile] = useState<File | null>(null);`;
const exportLogic = `
  const handleExportExcel = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      const { data: studentsData } = await supabase.from('students').select('*').order('stt');
      if (!studentsData || studentsData.length === 0) {
        alert('Không có dữ liệu!'); return;
      }
      
      const ws = XLSX.utils.json_to_sheet(studentsData.map(s => ({
        'STT': s.stt,
        'Họ và tên': s.name,
        'SBD / Email': s.email || '',
        'Toán (Thô)': s.tho_toan || 0,
        'TDKH (Thô)': s.tho_tdkh || 0,
        'Toán (IRT)': s.irt_toan || 0,
        'TDKH (IRT)': s.irt_tdkh || 0,
        'Toán (Thưởng phạt)': s.tp_toan || 0,
        'TDKH (Thưởng phạt)': s.tp_tdkh || 0
      })));
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DiemThi");
      XLSX.writeFile(wb, "BaoCao_DiemThi.xlsx");
    } catch (err) {
      console.error(err);
      alert('Lỗi xuất báo cáo Excel');
    } finally {
      setLoading(false);
    }
  };
`;
adminStr = adminStr.replace(hooksEnd, hooksEnd + '\n' + exportLogic);

// Add button to UI (near the Upload section)
const uploadSectionHeader = `<Upload className="w-5 h-5 text-emerald-600" />`;
const buttonHtml = `
      {/* Export Section */}
      <div className="card p-5 sm:p-6 mb-6 border border-indigo-200 bg-indigo-50/30">
        <h2 className="text-lg font-bold text-slate-800 flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            Tải Báo Cáo Excel
          </div>
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Xuất File (.xlsx)
          </button>
        </h2>
        <p className="text-sm text-slate-600">Tải toàn bộ bảng điểm của học sinh (đã phân loại các cột Thô, IRT, Thưởng Phạt) ra định dạng Excel chuẩn để làm báo cáo.</p>
      </div>
`;
adminStr = adminStr.replace(uploadSectionHeader, uploadSectionHeader + '\n' + buttonHtml);

// Fix the typo in replace by doing it carefully
adminStr = adminStr.replace(`{/* Upload Data Section */}`, buttonHtml + `\n      {/* Upload Data Section */}`);

fs.writeFileSync('AdminPage.tsx', adminStr);
console.log("AdminPage Excel Export added.");
