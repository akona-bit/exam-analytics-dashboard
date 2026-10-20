import { useMemo } from 'react';
import { BrainCircuit } from 'lucide-react';
import { QuestionData, StudentData } from '../../types';
import { latestAttempts } from '../../lib/analytics';
import {
  AbilityDifficultyKdeSection,
  DifficultyDiscriminationScatter,
  ItemQualitySection,
  TestCharacteristicSection,
} from './PsychometricInsights';

interface Props {
  students: StudentData[];
  questions: QuestionData[];
}

export function DeepAnalysis({ students, questions }: Props) {
  const latest = useMemo(() => latestAttempts(students), [students]);

  return (
    <section id="chuyen-sau" className="flex flex-col gap-5 fade-in">
      <div className="pt-1">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-slate-500" />
          Phân Tích Tâm Trắc Chuyên Sâu Đề Thi
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Boxplot độ khó/độ phân biệt · đường cong đặc tính bài thi (TCC) · phân bố năng lực – độ khó (KDE) · bản đồ b–a
        </p>
      </div>

      <ItemQualitySection questions={questions} />
      <TestCharacteristicSection questions={questions} students={latest} />
      <AbilityDifficultyKdeSection questions={questions} students={latest} />
      <DifficultyDiscriminationScatter questions={questions} />
    </section>
  );
}
