import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import {
  parseStudentsCsv,
  parseResponsesCsv,
  parseQuestionsCsv,
  type ParsedStudent,
  type ParsedResponse,
  type ParsedQuestion,
} from '../src/lib/csvParser.js';

let memStudents: ParsedStudent[] = [];
let memResponses: ParsedResponse[] = [];
let memQuestions: ParsedQuestion[] = [];

async function readCsv(name: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), name), 'utf-8');
  } catch (e) {
    console.error(`Failed to load ${name}:`, e);
    return null;
  }
}

async function loadData() {
  console.log('Loading CSV data into memory...');

  const studentsCsv = await readCsv('raw_students.csv');
  if (studentsCsv !== null) {
    memStudents = parseStudentsCsv(studentsCsv);
  }

  const responsesCsv = await readCsv('raw_student_responses.csv');
  if (responsesCsv !== null) {
    memResponses = parseResponsesCsv(responsesCsv, memStudents);
  }

  const questionsCsv = await readCsv('questions.csv');
  if (questionsCsv !== null) {
    memQuestions = parseQuestionsCsv(questionsCsv);
  }

  console.log(`Loaded ${memStudents.length} students, ${memResponses.length} responses, ${memQuestions.length} questions.`);
}

async function startServer() {
  await loadData();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.use(express.json());

  // API Routes
  app.get('/api/students', (req, res) => {
    try {
      const responsesMap = new Map<number, { question_num: number; status: string }[]>();
      for (const r of memResponses) {
        let list = responsesMap.get(r.student_stt);
        if (!list) {
          list = [];
          responsesMap.set(r.student_stt, list);
        }
        list.push({ question_num: r.question_num, status: r.status });
      }

      const formatted = [...memStudents]
        .sort((a, b) => a.stt - b.stt)
        .map(s => ({
          stt: s.stt,
          sbd: s.sbd,
          name: s.name,
          email: s.email,
          gender: s.gender,
          maDe: s.ma_de,
          tho: { toan: s.tho_toan, tdkh: s.tho_tdkh, tv: s.tho_tv, ta: s.tho_ta },
          irt: { toan: s.irt_toan, tdkh: s.irt_tdkh, tv: s.irt_tv, ta: s.irt_ta },
          note: s.note,
          responses: responsesMap.get(s.stt) || [],
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
        id: q.question_id,
        subject: q.subject,
        totalAttempts: q.total_attempts,
        correct: q.correct,
        incorrect: q.incorrect,
        difficulty: q.difficulty,
        discrimination: q.discrimination,
        isError: q.is_error,
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