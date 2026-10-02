export type MetricKey = 'tho' | 'irt' | 'thuongPhat';
export type SubjectKey = 'toan' | 'tdkh';

export interface QuestionData {
  id: string;
  subject: string;
  totalAttempts: number | null;
  correct: number | null;
  incorrect: number | null;
  penaltyScore: number | null;
  bonus1: number | null;
  bonus2: number | null;
  bonus3: number | null;
  bonusCorrect: number | null;
  isError?: boolean;
}

export interface StudentData {
  stt: number;
  name: string;
  email?: string;
  tho: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
  irt: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
  thuongPhat: { toan: number | null; tdkh: number | null; tv: number | null; ta: number | null };
  note?: string;
  responses?: { question_num: number; status: string }[];
}

