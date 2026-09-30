/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Dashboard } from './Dashboard';
import { QuestionData, StudentData } from './types';

export default function App() {
  const [data, setData] = useState<QuestionData[]>([]);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

    const fetchJson = async (apiPath: string, staticPath: string) => {
      try {
        const res = await fetch(apiPath);
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          return await res.json();
        }
      } catch {
        // API không khả dụng (vd: GitHub Pages) -> đọc file JSON tĩnh
      }
      const res = await fetch(`${base}${staticPath}`);
      if (!res.ok) throw new Error(`Không tải được ${staticPath}`);
      return res.json();
    };

    Promise.all([
      fetchJson('/api/questions', 'data/questions.json'),
      fetchJson('/api/students', 'data/students.json')
    ]).then(([questions, students]) => {
      setData(questions);
      setStudentData(students);
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to fetch data:', err);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="min-h-[100dvh] w-screen bg-[#f8fafc]">
      <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
            <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <Dashboard questions={data} students={studentData} />
        )}
        
        <footer className="mt-12 mb-6 text-center text-slate-500 text-sm font-medium">
          Hẹn gặp lại các bạn vào đợt thi tiếp theo, dự kiến vào tháng 12
        </footer>
      </main>
    </div>
  );
}
