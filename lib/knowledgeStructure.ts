/**
 * Knowledge Area & Topic Structure Parser
 * Parses CSV mapping of domains, topics, question counts, and question numbers.
 */

export interface TopicItem {
  name: string;
  count: number;
  qNums: number[];
}

export interface DomainCategory {
  domain: string;
  topics: TopicItem[];
  qNums: number[];
  total: number;
  color?: string;
  bgColor?: string;
  barColor?: string;
}

export interface ParsedKnowledgeStructure {
  domains: DomainCategory[];
  topicMap: Record<string, number[]>;
  totalQuestions: number;
  is120Mode: boolean;
}

export const DEFAULT_KNOWLEDGE_CSV = `,Kiến thức,,
Tri thức ngữ văn,Văn học cổ đại và sân khấu,2,12
,,,
,"Thơ (trung đại, hiện đại, cận đại)",5,
,,,
,,,
,"Văn xuôi, kịch, kí, tri thức ngữ văn khác",5,
,,,
Ngữ pháp,Chỉnh tả,2,8
,,,
,,,
,Chữa lỗi trong câu/từ,2,
,,,
,,,
,,,
,,,
,Nghĩa hoặc cấu trúc của từ hoặc câu,4,
,,,
,,,
,,,
,,,
Đọc hiểu văn bản,Văn bản thông tin,5,10
,,,
,,,
,,,
,,,
,,,
,,,
,,,
,,,
,Văn bản nghị luận (xã hội/văn học),5,
,,,
,,,
,,,
,,,
,,,
,,,
,,,
Ngữ pháp,Điền khuyết,5,15
,,,
,,,
,,,
,,,
,Tìm lỗi sai,5,
,,,
,,,
,,,
,,,
,Viết lại câu,5,
,,,
,,,
,,,
,,,
Đọc hiểu,Đọc hiểu đời sống,7,15
,,,
,,,
,,,
,,,
,,,
,Đọc hiểu học thuật,8,
,,,
,,,
,,,
,,,
,,,
,,,
,,,
Giải tích,"Nguyên hàm, tích phân",2,9
,,,
,"Giới hạn, hàm số liên tục",2,
,,,
,"Khảo sát hàm số (bậc 3, phân thức). Có thể có tham số",3,
,,,
,,,
,,,
,,,
,"Cấp số cộng/nhân, dãy số",1,
,,,
,,1,
Đại số,"Số mũ, logarit",2,7
,,,
,,,
,"Giải, xét dấu, biện luận phương trình/bất phương trình/Hệ phương trình",2,
,,,
,,,
,Quy hoạch tuyến tính,2,
,,,
,Lượng giác,1,
,,,
Hình học,Hinh học phẳng,1,9
,,,
,,,
,,,
,Hệ toạ độ Oxy,3,
,,,
,,,
,,,
,Hệ toạ độ Oxyz,2,
,,,
,,,
,,,
,Hình học không gian,3,
,,,
,,,
,,,
Toán rời rạc và xác suất,Xác suất,3,5
,,,
,,,
,,,
,,,
,Lý thuyết đồ thị,2,
,,,
Logic & PTSL,Logic đơn nhóm,3,6
,Logic đa nhóm,3,
,PTSL bảng,3,6
,PTSL biểu đồ,3,
SLKH (KHTN),Lý,3,9
,Hoá,3,
,Sinh,3,
SLKH (KHXH),Địa,3,9
,Sử,3,
,KTPL,3,`;

const DOMAIN_PALETTES: Record<string, { color: string; bgColor: string; barColor: string }> = {
  'Tri thức ngữ văn': { color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-500/10 border-amber-500/20', barColor: 'bg-amber-500' },
  'Ngữ pháp': { color: 'text-teal-700 dark:text-teal-300', bgColor: 'bg-teal-500/10 border-teal-500/20', barColor: 'bg-teal-500' },
  'Ngữ pháp (Tiếng Việt)': { color: 'text-teal-700 dark:text-teal-300', bgColor: 'bg-teal-500/10 border-teal-500/20', barColor: 'bg-teal-500' },
  'Ngữ pháp (Tiếng Anh)': { color: 'text-sky-700 dark:text-sky-300', bgColor: 'bg-sky-500/10 border-sky-500/20', barColor: 'bg-sky-500' },
  'Đọc hiểu văn bản': { color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
  'Đọc hiểu': { color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500' },
  'Đọc hiểu (Tiếng Anh)': { color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500' },
  'Giải tích': { color: 'text-indigo-700 dark:text-indigo-300', bgColor: 'bg-indigo-500/10 border-indigo-500/20', barColor: 'bg-indigo-500' },
  'Đại số': { color: 'text-violet-700 dark:text-violet-300', bgColor: 'bg-violet-500/10 border-violet-500/20', barColor: 'bg-violet-500' },
  'Hình học': { color: 'text-purple-700 dark:text-purple-300', bgColor: 'bg-purple-500/10 border-purple-500/20', barColor: 'bg-purple-500' },
  'Toán rời rạc và xác suất': { color: 'text-pink-700 dark:text-pink-300', bgColor: 'bg-pink-500/10 border-pink-500/20', barColor: 'bg-pink-500' },
  'Logic & PTSL': { color: 'text-cyan-700 dark:text-cyan-300', bgColor: 'bg-cyan-500/10 border-cyan-500/20', barColor: 'bg-cyan-500' },
  'SLKH (KHTN)': { color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
  'SLKH (KHXH)': { color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500' },
};

function getPalette(name: string) {
  if (DOMAIN_PALETTES[name]) return DOMAIN_PALETTES[name];
  const keys = Object.keys(DOMAIN_PALETTES);
  const hash = Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return DOMAIN_PALETTES[keys[hash % keys.length]];
}

/**
 * Robust CSV parser that handles quotes and multiple lines
 */
export function parseCSVRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim() && rows.length === 0) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * Parses the Knowledge CSV into structured domains, topics, and question lists.
 * @param csvText The raw CSV string
 * @param examMaxQuestion The maximum question number found in the active exam (e.g. 60 or 120)
 */
export function parseKnowledgeCSV(csvText: string, examMaxQuestion = 120): ParsedKnowledgeStructure {
  const rows = parseCSVRows(csvText || DEFAULT_KNOWLEDGE_CSV);
  
  interface RawEntry {
    domain: string;
    topic: string;
    count: number;
  }

  const rawEntries: RawEntry[] = [];
  let currentDomain = '';
  let currentTopic = '';
  let seenNgữPháp = 0;

  for (let i = 0; i < rows.length; i++) {
    const [col0, col1, col2] = rows[i];
    // Skip header
    if (i === 0 && (col1?.toLowerCase().includes('kiến thức') || col0?.toLowerCase().includes('kiến thức'))) {
      continue;
    }

    if (col0 && col0.trim()) {
      const trimmedCol0 = col0.trim();
      if (trimmedCol0 === 'Ngữ pháp') {
        seenNgữPháp++;
        currentDomain = seenNgữPháp === 1 ? 'Ngữ pháp (Tiếng Việt)' : 'Ngữ pháp (Tiếng Anh)';
      } else if (trimmedCol0 === 'Đọc hiểu') {
        currentDomain = 'Đọc hiểu (Tiếng Anh)';
      } else {
        currentDomain = trimmedCol0;
      }
    }
    if (col1 && col1.trim()) currentTopic = col1.trim();

    const count = parseInt(col2, 10);
    if (!isNaN(count) && count > 0) {
      // If same domain & topic appears consecutively (e.g. Cấp số cộng/nhân on row 77 & 79)
      const last = rawEntries[rawEntries.length - 1];
      if (last && last.domain === currentDomain && last.topic === currentTopic) {
        last.count += count;
      } else {
        rawEntries.push({
          domain: currentDomain || 'Kiến thức chung',
          topic: currentTopic || 'Chuyên đề',
          count,
        });
      }
    }
  }

  const totalQuestionsInCSV = rawEntries.reduce((sum, e) => sum + e.count, 0);

  // If exam has max questions <= 60 and CSV has 120 questions,
  // map to the Math + TDKH portion (60 questions).
  const is60MathExam = examMaxQuestion <= 60 && totalQuestionsInCSV >= 120;
  
  let entriesToUse = rawEntries;
  if (is60MathExam) {
    const mathAndTdkhDomains = new Set([
      'Giải tích', 'Đại số', 'Hình học', 'Toán rời rạc và xác suất', 
      'Logic & PTSL', 'SLKH (KHTN)', 'SLKH (KHXH)', 'Toán', 'TDKH'
    ]);
    const filtered = rawEntries.filter(e => mathAndTdkhDomains.has(e.domain));
    if (filtered.length > 0 && filtered.reduce((s, e) => s + e.count, 0) === 60) {
      entriesToUse = filtered;
    }
  }

  // Preserve sequential domain groups
  interface DomainGroup {
    domain: string;
    topics: TopicItem[];
  }

  const domainGroups: DomainGroup[] = [];
  let currentGroup: DomainGroup | null = null;
  let currentQNum = 1;
  const topicMap: Record<string, number[]> = {};

  for (const entry of entriesToUse) {
    if (!currentGroup || currentGroup.domain !== entry.domain) {
      currentGroup = { domain: entry.domain, topics: [] };
      domainGroups.push(currentGroup);
    }

    const qNums: number[] = [];
    for (let c = 0; c < entry.count; c++) {
      qNums.push(currentQNum);
      currentQNum++;
    }

    currentGroup.topics.push({
      name: entry.topic,
      count: entry.count,
      qNums,
    });

    if (topicMap[entry.topic]) {
      topicMap[entry.topic] = [...topicMap[entry.topic], ...qNums];
    } else {
      topicMap[entry.topic] = qNums;
    }
  }

  const domains: DomainCategory[] = domainGroups.map(group => {
    const allQNums = group.topics.flatMap(t => t.qNums);
    const palette = getPalette(group.domain);
    return {
      domain: group.domain,
      topics: group.topics,
      qNums: allQNums,
      total: allQNums.length,
      ...palette,
    };
  });

  return {
    domains,
    topicMap,
    totalQuestions: currentQNum - 1,
    is120Mode: !is60MathExam && totalQuestionsInCSV >= 120,
  };
}

export const defaultTopicMap: Record<string, number[]> = parseKnowledgeCSV(DEFAULT_KNOWLEDGE_CSV, 60).topicMap;

