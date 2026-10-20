import type { QuestionData, StudentData } from '../types';
import reference from './referencePsychometrics.json';

interface RefItem {
  id: number;
  s: number;
  p: number;
  a: number;
  b: number;
  d: number;
  inf: number;
  out: number;
  g: string;
  k: string;
  obs: [number, number][];
}

interface RefStudent {
  theta: number[];
  correct: number[];
  sectionScores: number[];
  total: number;
  rank: number;
}

const itemsById = new Map<number, RefItem>(
  (reference.items as RefItem[]).map(item => [item.id, item]),
);

const studentsBySbd = new Map<string, RefStudent>(
  Object.entries(reference.students as Record<string, RefStudent>),
);

const qNumOf = (id: string): number => {
  const n = Number(String(id).replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Bổ sung thông số tâm trắc đầy đủ (D-index, infit, outfit, đường cong ICC)
 * từ file dashboard tham chiếu cho 120 câu hỏi.
 */
export function enrichQuestions(questions: QuestionData[]): QuestionData[] {
  if (!questions.length) return questions;
  return questions.map(q => {
    const ref = itemsById.get(qNumOf(q.id));
    if (!ref) return q;
    return {
      ...q,
      dIndex: ref.d,
      infit: ref.inf,
      outfit: ref.out,
      obs: ref.obs,
      groupName: ref.g,
      topicName: ref.k,
    };
  });
}

/**
 * Bổ sung năng lực theta (theo từng phần thi) cho thí sinh, phục vụ TCC/KDE.
 * Khớp theo SBD — dữ liệu tham chiếu có cùng 625 thí sinh.
 */
export function enrichStudents(students: StudentData[]): StudentData[] {
  if (!students.length) return students;
  return students.map(s => {
    const ref = s.sbd ? studentsBySbd.get(String(s.sbd)) : undefined;
    if (!ref) return s;
    const [tv, ta, toan, tdkh] = ref.theta;
    const [tvCorrect, taCorrect, toanCorrect, tdkhCorrect] = ref.correct;
    return {
      ...s,
      theta: { tv, ta, toan, tdkh },
      // Điền điểm thô (số câu đúng) còn thiếu từ dữ liệu tham chiếu.
      tho: {
        tv: s.tho?.tv ?? tvCorrect,
        ta: s.tho?.ta ?? taCorrect,
        toan: s.tho?.toan ?? toanCorrect,
        tdkh: s.tho?.tdkh ?? tdkhCorrect,
      },
    };
  });
}
