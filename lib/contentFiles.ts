/**
 * Nội dung tĩnh của kì thi lấy từ file ở thư mục gốc.
 *
 * Cả hai đều được `import` kiểu glob thay vì import tĩnh, nên thiếu file
 * vẫn build được (clone mới hoặc CI không cần copy file):
 *   - knowledge_structure.csv — bản đồ Vùng kiến thức / Chuyên đề, đã commit.
 *   - question_texts.json     — nội dung câu hỏi, gitignore; runtime lấy từ Supabase.
 */

const csvModules = import.meta.glob('../knowledge_structure.csv', { eager: true, query: '?raw', import: 'default' });
const textsModules = import.meta.glob('../question_texts.json', { eager: true, import: 'default' });

export const KNOWLEDGE_CSV_FILE = '../knowledge_structure.csv';
export const QUESTION_TEXTS_FILE = '../question_texts.json';

/** CSV vùng kiến thức từ file, rỗng nếu thiếu file. */
export const knowledgeCsvFile: string = (Object.values(csvModules)[0] as string) ?? '';

/** Nội dung câu hỏi từ file, rỗng nếu thiếu file. */
export const questionTextsFile: Record<string, string> =
  (Object.values(textsModules)[0] as Record<string, string>) ?? {};

export const hasKnowledgeCsvFile = knowledgeCsvFile.trim().length > 0;
export const hasQuestionTextsFile = Object.keys(questionTextsFile).length > 0;