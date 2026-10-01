import fs from 'fs';

let adminStr = fs.readFileSync('AdminPage.tsx', 'utf8');

// 1. ADD UPLOAD LOGIC
const fetchStatsStr = `/* ──────────── Helper: fetch stats ──────────── */`;
const uploadLogic = `
async function uploadToSupabase(table: string, data: any[]) {
  if (!supabase) throw new Error('No supabase client');
  
  // Delete all rows safely
  const { error: delErr } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw delErr;

  // Insert in chunks of 500
  for (let i = 0; i < data.length; i += 500) {
    const chunk = data.slice(i, i + 500);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}
`;
adminStr = adminStr.replace(fetchStatsStr, uploadLogic + '\n' + fetchStatsStr);

// 2. ADD handleUpload inside AdminPage
const stateHooksEnd = `const [clearConfirm, setClearConfirm] = useState(false);`;
const handleUploadCode = `
  const handleUpload = async () => {
    if (!studentsFile || !responsesFile || !questionsFile) {
      setUploadStatus({ type: 'error', msg: 'Vui lòng chọn đủ cả 3 file!' });
      return;
    }

    setLoading(true);
    setUploadStatus(null);
    setUploadProgress('Đang đọc file...');

    try {
      const readFile = (f: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = e => reject(e);
        reader.readAsText(f);
      });

      const [studentsTxt, responsesTxt, questionsTxt] = await Promise.all([
        readFile(studentsFile), readFile(responsesFile), readFile(questionsFile)
      ]);

      setUploadProgress('Đang xử lý dữ liệu...');
      const students = parseStudents(studentsTxt);
      const responses = parseResponses(responsesTxt, students);
      const questions = parseQuestions(questionsTxt);

      if (students.length === 0 || questions.length === 0) {
        throw new Error('Dữ liệu trống hoặc file không hợp lệ!');
      }

      setUploadProgress('Đang tải dữ liệu học sinh lên máy chủ...');
      await uploadToSupabase('students', students);

      setUploadProgress('Đang tải dữ liệu câu hỏi lên máy chủ...');
      await uploadToSupabase('questions', questions);

      setUploadProgress('Đang tải dữ liệu bài làm lên máy chủ...');
      await uploadToSupabase('student_responses', responses);

      setUploadStatus({ type: 'success', msg: \`Thành công! Đã tải lên \${students.length} học sinh và \${questions.length} câu hỏi.\` });
      refreshStats();
      
      // Clear file inputs
      setStudentsFile(null);
      setResponsesFile(null);
      setQuestionsFile(null);
    } catch (err: any) {
      console.error(err);
      setUploadStatus({ type: 'error', msg: \`Lỗi: \${err.message || 'Không xác định'}\` });
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };
`;
adminStr = adminStr.replace(stateHooksEnd, stateHooksEnd + '\n' + handleUploadCode);

// 3. ADD UPLOAD UI
const settingsSection = `{/* Exam settings section */}`;
const uploadUI = `
      {/* Upload Data Section */}
      <div className="card p-5 sm:p-6 mb-6 border border-emerald-200 bg-emerald-50/30">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-emerald-600" />
          Cập nhật dữ liệu điểm (CSV)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">File Học sinh (raw_students.csv)</label>
            <input type="file" accept=".csv" onChange={e => setStudentsFile(e.target.files?.[0] || null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">File Bài làm (raw_student_responses.csv)</label>
            <input type="file" accept=".csv" onChange={e => setResponsesFile(e.target.files?.[0] || null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">File Câu hỏi (questions.csv)</label>
            <input type="file" accept=".csv" onChange={e => setQuestionsFile(e.target.files?.[0] || null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
          </div>
        </div>
        
        {uploadStatus && (
          <div className={\`flex items-center gap-2 text-sm px-4 py-3 rounded-lg mb-4 \${uploadStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}\`}>
            {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            {uploadStatus.msg}
          </div>
        )}
        
        <button
          onClick={handleUpload}
          disabled={loading || !studentsFile || !responsesFile || !questionsFile}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {loading ? uploadProgress || 'Đang xử lý...' : 'Tải lên & Cập nhật'}
        </button>
      </div>

`;
adminStr = adminStr.replace(settingsSection, uploadUI + '\n      ' + settingsSection);

fs.writeFileSync('AdminPage.tsx', adminStr);
console.log("AdminPage refactored successfully.");
