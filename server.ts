function parseCSVLine(text: string): string[] { const result: string[] = []; let current = ""; let inQuotes = false; for (let i = 0; i < text.length; i++) { const char = text[i]; if (char === "\"" && text[i+1] === "\"") { current += "\""; i++; } else if (char === "\"") { inQuotes = !inQuotes; } else if (char === "," && !inQuotes) { result.push(current); current = ""; } else { current += char; } } result.push(current); return result; }
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = typeof import.meta !== "undefined" && typeof import.meta.url === "string" ? fileURLToPath(import.meta.url) : "";
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

let memStudents: any[] = [];
let memResponses: any[] = [];
let memQuestions: any[] = [];

async function loadData() {
  console.log('Loading CSV data into memory...');
  
  // Load students
  try {
    const rawStudentsPath = path.join(process.cwd(), 'raw_students.csv');
    const rawStudents = await fs.readFile(rawStudentsPath, 'utf-8');
    const lines = rawStudents.split('\n').map(l => l.trim()).filter(l => l);
    const dataLines = lines.slice(2);
    
    for (const line of dataLines) {
      const parts = parseCSVLine(line);
      if (parts.length >= 8) {
        memStudents.push({
          stt: parseInt(parts[0], 10),
          name: parts[2] || parts[1], // fallback to id if name is missing
          email: parts[3] || null,
          tho_toan: parseFloat(parts[4]),
          tho_tdkh: parseFloat(parts[5]),
          irt_toan: parseFloat(parts[6]),
          irt_tdkh: parseFloat(parts[7]),
          thuong_phat_toan: parseFloat(parts[8]),
          thuong_phat_tdkh: parseFloat(parts[9]),
          note: '',
        });
      }
    }
  } catch (e) {
    console.error('Failed to load students:', e);
  }

  // Load responses
  try {
    const rawResponsesPath = path.join(process.cwd(), 'raw_student_responses.csv');
    const rawResponses = await fs.readFile(rawResponsesPath, 'utf-8');
    const lines = rawResponses.split('\n').map(l => l.trim()).filter(l => l);
    const dataLines = lines.slice(1);
    
    let stt = 1;
    for (const line of dataLines) {
      const parts = parseCSVLine(line);
      if (parts.length >= 74) {
        let name = parts[0] || parts[1];
        let email = parts[3] || parts[9] || null;
        let qStartIdx = 14;

        const checkIdx = parts.findIndex(p => p && p.trim().toUpperCase() === 'TRUE');
        if (checkIdx !== -1) {
          name = parts[checkIdx - 10] || parts[checkIdx - 11];
          email = parts[checkIdx - 8] || parts[checkIdx - 2] || null;
          qStartIdx = checkIdx + 3;
        } else {
          const firstContentIdx = parts.findIndex(p => p && p.trim().length > 0);
          if (firstContentIdx > 0 && firstContentIdx <= 6) {
            name = parts[firstContentIdx] || parts[firstContentIdx + 1];
            qStartIdx = firstContentIdx + 14;
          }
        }

        if (!name) continue;

        if (email) {
          const s = memStudents.find(s => s.name === name && s.stt === stt);
          if (s) s.email = email;
          else {
             // Fallback to updating any matching name if exact STT mismatch
             const anyS = memStudents.find(s => s.name === name);
             if (anyS && !anyS.email) anyS.email = email;
          }
        }
        
        for (let i = 0; i < 60; i++) {
          let val = parts[qStartIdx + i];
          if (val) val = val.trim();
          let status = 'wrong';
          
          if (val === '1' || val === '1.0' || val === '1.00' || val === '0.1' || val === '0.25' || val === '0.5') {
            status = 'correct';
          } else if (val === '0' || val === '0.0' || val === '0.00') {
            status = 'wrong';
          } else if (val === '' || val === '-1' || val === '\r' || val === '\r\n' || !val) {
            status = 'missing';
          } else {
            let numVal = parseFloat(val);
            if (numVal > 0) status = 'correct';
            else if (numVal === 0) status = 'wrong';
            else status = 'missing';
          }
          
          if ((i + 1) === 4) {
            status = 'correct';
          }
          
          memResponses.push({
            student_name: name,
            stt: stt,
            question_num: (i + 1),
            status: status
          });
        }
        stt++;
      }
    }
  } catch(e) {
    console.error('Failed to load student responses:', e);
  }

  // Load questions
  try {
    const rawQuestionsPath = path.join(process.cwd(), 'questions.csv');
    const rawQuestions = await fs.readFile(rawQuestionsPath, 'utf-8');
    const lines = rawQuestions.split('\n').map(l => l.trim()).filter(l => l);
    const dataLines = lines.slice(2);
    let currentPhanThi = '';
    
    for (const line of dataLines) {
      const parts = parseCSVLine(line);
      if (parts.length >= 11) {
        if (parts[0]) currentPhanThi = parts[0];
        
        const parseFloatSafe = (val: string) => val ? parseFloat(val) : null;
        const parseIntSafe = (val: string) => val ? parseInt(val, 10) : null;
        
        memQuestions.push({
          phan_thi: currentPhanThi,
          cau_hoi: parts[1],
          hs_da_lam: parseIntSafe(parts[2]),
          hs_lam_dung: parseIntSafe(parts[3]),
          hs_lam_sai: parseIntSafe(parts[4]),
          diem_phat: parseFloatSafe(parts[5]),
          diem_thuong_1_y: parseFloatSafe(parts[6]),
          diem_thuong_2_y: parseFloatSafe(parts[7]),
          diem_thuong_3_y: parseFloatSafe(parts[8]),
          diem_thuong_dung: parseFloatSafe(parts[9]),
          isError: parts[2] === 'LỖI ĐỀ THI' || parts[1] === 'Câu 4'
        });
      }
    }
  } catch(e) {
    console.error('Failed to load questions:', e);
  }
}

async function startServer() {
  await loadData();
  
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.use(express.json());

  // API Routes
  app.get('/api/students', (req, res) => {
    try {
      const students = memStudents.sort((a, b) => a.stt - b.stt);
      const responses = memResponses.filter(r => r.status !== 'correct');
      
      const responsesMap = new Map<number, any[]>();
      for (const r of responses) {
        if (!responsesMap.has(r.stt)) {
          responsesMap.set(r.stt, []);
        }
        responsesMap.get(r.stt)!.push({ question_num: r.question_num, status: r.status });
      }

      // Format response to match frontend expectations
      const formatted = students.map(s => ({
        stt: s.stt,
        name: s.name,
        email: s.email,
        tho: { toan: s.tho_toan, tdkh: s.tho_tdkh },
        irt: { toan: s.irt_toan, tdkh: s.irt_tdkh },
        thuongPhat: { toan: s.thuong_phat_toan, tdkh: s.thuong_phat_tdkh },
        note: s.note,
        responses: responsesMap.get(s.stt) || []
      }));
      res.json(formatted);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/questions', (req, res) => {
    try {
      const formatted = memQuestions.map(q => ({
        id: q.cau_hoi,
        subject: q.phan_thi,
        totalAttempts: q.hs_da_lam,
        correct: q.hs_lam_dung,
        incorrect: q.hs_lam_sai,
        penaltyScore: q.diem_phat,
        bonus1: q.diem_thuong_1_y,
        bonus2: q.diem_thuong_2_y,
        bonus3: q.diem_thuong_3_y,
        bonusCorrect: q.diem_thuong_dung,
        isError: q.isError
      }));
      res.json(formatted);
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.log('Running without Vite dev server');
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
