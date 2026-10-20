/**
 * Knowledge Area & Topic Structure Parser
 * Parses CSV mapping of domains, topics, question counts, and question numbers.
 * Supports 3-level hierarchy: Phần thi (TV, TA, TO, TDKH) -> Gom nhóm -> Chuyên đề kiến thức
 */

import { knowledgeCsvFile } from './contentFiles';

export type SubjectCode = 'TV' | 'TA' | 'TO' | 'TDKH';

export interface TopicItem {
  name: string;
  count: number;
  qNums: number[];
  subjectCode?: SubjectCode;
  groupName?: string;
}

export interface DomainCategory {
  domain: string;
  subjectCode?: SubjectCode;
  topics: TopicItem[];
  qNums: number[];
  total: number;
  color?: string;
  bgColor?: string;
  barColor?: string;
}

export interface PhanThiSection {
  code: SubjectCode;
  name: string;
  gomNhoms: DomainCategory[];
  topics: TopicItem[];
  qNums: number[];
  total: number;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}

export interface ParsedKnowledgeStructure {
  phanThis: PhanThiSection[];
  domains: DomainCategory[];
  totalQuestions: number;
  is120Mode: boolean;
}

export const DEFAULT_KNOWLEDGE_CSV = knowledgeCsvFile;

/**
 * Thứ tự các phần thi trong đề 120 câu. CSV không ghi mã môn, nên môn của một vùng
 * kiến thức được suy ra từ vị trí câu (30 câu/môn) — cùng cách
 * `getQuestionKnowledgeInfo` đang dự phòng.
 */
const SUBJECT_SEQUENCE: { code: SubjectCode; name: string; size: number }[] = [
  { code: 'TV', name: 'Tiếng Việt', size: 30 },
  { code: 'TA', name: 'Tiếng Anh', size: 30 },
  { code: 'TO', name: 'Toán học', size: 30 },
  { code: 'TDKH', name: 'Tư duy khoa học', size: 30 },
];

const SUBJECT_NAME: Record<SubjectCode, string> = {
  TV: 'Tiếng Việt',
  TA: 'Tiếng Anh',
  TO: 'Toán học',
  TDKH: 'Tư duy khoa học',
};

function subjectOf(qNum: number): SubjectCode {
  let start = 1;
  for (const s of SUBJECT_SEQUENCE) {
    if (qNum >= start && qNum < start + s.size) return s.code;
    start += s.size;
  }
  return SUBJECT_SEQUENCE[SUBJECT_SEQUENCE.length - 1].code;
}

const DOMAIN_PALETTES: Record<string, { color: string; bgColor: string; barColor: string }> = {
  'Tri thức ngữ văn': { color: 'text-amber-700', bgColor: 'bg-amber-500/10 border-amber-500/20', barColor: 'bg-amber-500' },
  'Ngữ pháp': { color: 'text-teal-700', bgColor: 'bg-teal-500/10 border-teal-500/20', barColor: 'bg-teal-500' },
  'Ngữ pháp và Thực hành Tiếng Việt': { color: 'text-teal-700', bgColor: 'bg-teal-500/10 border-teal-500/20', barColor: 'bg-teal-500' },
  'Ngữ pháp (Tiếng Việt)': { color: 'text-teal-700', bgColor: 'bg-teal-500/10 border-teal-500/20', barColor: 'bg-teal-500' },
  'Ngữ pháp (Tiếng Anh)': { color: 'text-sky-700', bgColor: 'bg-sky-500/10 border-sky-500/20', barColor: 'bg-sky-500' },
  'Đọc hiểu văn bản': { color: 'text-emerald-700', bgColor: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
  'Đọc hiểu': { color: 'text-blue-700', bgColor: 'bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500' },
  'Đọc hiểu (Tiếng Anh)': { color: 'text-blue-700', bgColor: 'bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500' },
  'Giải tích': { color: 'text-indigo-700', bgColor: 'bg-indigo-500/10 border-indigo-500/20', barColor: 'bg-indigo-500' },
  'Đại số': { color: 'text-violet-700', bgColor: 'bg-violet-500/10 border-violet-500/20', barColor: 'bg-violet-500' },
  'Hình học': { color: 'text-purple-700', bgColor: 'bg-purple-500/10 border-purple-500/20', barColor: 'bg-purple-500' },
  'Toán rời rạc và xác suất': { color: 'text-pink-700', bgColor: 'bg-pink-500/10 border-pink-500/20', barColor: 'bg-pink-500' },
  'Logic & PTSL': { color: 'text-cyan-700', bgColor: 'bg-cyan-500/10 border-cyan-500/20', barColor: 'bg-cyan-500' },
  'Logic & Phân tích số liệu': { color: 'text-cyan-700', bgColor: 'bg-cyan-500/10 border-cyan-500/20', barColor: 'bg-cyan-500' },
  'SLKH (KHTN)': { color: 'text-emerald-700', bgColor: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
  'Suy luận khoa học (KHTN)': { color: 'text-emerald-700', bgColor: 'bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
  'SLKH (KHXH)': { color: 'text-orange-700', bgColor: 'bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500' },
  'Suy luận khoa học (KHXH)': { color: 'text-orange-700', bgColor: 'bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500' },
};

function hashPalette(name: string) {
  const keys = Object.keys(DOMAIN_PALETTES);
  const hash = Math.abs(name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return DOMAIN_PALETTES[keys[hash % keys.length]];
}

/**
 * Chọn màu cho một vùng kiến thức.
 *
 * CSV có các tên vùng trùng nhau giữa 4 môn (Ngữ pháp của Tiếng Việt và của Tiếng Anh,
 * Đọc hiểu của Tiếng Anh…), nên phải thử khoá dạng `Tên (Tên môn)` trước khi lùi về
 * tên trần. Chỉ khi cả hai đều không có mới băm chuỗi để gán màu ngẫu nhiên ổn định.
 */
function paletteFor(domain: string, subjectCode?: SubjectCode) {
  const subjectName = subjectCode ? SUBJECT_NAME[subjectCode] : '';
  const keys = subjectName ? [`${domain} (${subjectName})`, domain] : [domain];
  for (const key of keys) {
    if (DOMAIN_PALETTES[key]) return DOMAIN_PALETTES[key];
  }
  return hashPalette(domain);
}

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
 * Standard Hardcoded 120-question Matrix matching the exam specification
 */
export const STANDARD_120_MATRIX: {
  code: 'TV' | 'TA' | 'TO' | 'TDKH';
  name: string;
  gomNhoms: {
    name: string;
    topics: { name: string; count: number }[];
  }[];
}[] = [
  {
    code: 'TV',
    name: 'Tiếng Việt',
    gomNhoms: [
      {
        name: 'Tri thức ngữ văn',
        topics: [
          { name: 'Văn học cổ đại và sân khấu', count: 2 },
          { name: 'Thơ (trung đại, hiện đại, cận đại)', count: 5 },
          { name: 'Văn xuôi, kịch, kí, tri thức ngữ văn khác', count: 5 },
        ],
      },
      {
        name: 'Ngữ pháp',
        topics: [
          { name: 'Chỉnh tả', count: 2 },
          { name: 'Chữa lỗi trong câu/từ', count: 2 },
          { name: 'Nghĩa hoặc cấu trúc của từ hoặc câu', count: 4 },
        ],
      },
      {
        name: 'Đọc hiểu văn bản',
        topics: [
          { name: 'Văn bản thông tin', count: 5 },
          { name: 'Văn bản nghị luận (xã hội/văn học)', count: 5 },
        ],
      },
    ],
  },
  {
    code: 'TA',
    name: 'Tiếng Anh',
    gomNhoms: [
      {
        name: 'Ngữ pháp',
        topics: [
          { name: 'Điền khuyết', count: 5 },
          { name: 'Tìm lỗi sai', count: 5 },
          { name: 'Viết lại câu', count: 5 },
        ],
      },
      {
        name: 'Đọc hiểu',
        topics: [
          { name: 'Đọc hiểu đời sống', count: 7 },
          { name: 'Đọc hiểu học thuật', count: 8 },
        ],
      },
    ],
  },
  {
    code: 'TO',
    name: 'Toán học',
    gomNhoms: [
      {
        name: 'Giải tích',
        topics: [
          { name: 'Nguyên hàm, tích phân', count: 2 },
          { name: 'Giới hạn, hàm số liên tục', count: 2 },
          { name: 'Khảo sát hàm số (bậc 3, phân thức). Có thể có tham số', count: 3 },
          { name: 'Cấp số cộng/nhân, dãy số', count: 2 },
        ],
      },
      {
        name: 'Đại số',
        topics: [
          { name: 'Số mũ, logarit', count: 2 },
          { name: 'Giải, xét dấu, biện luận phương trình/bất phương trình/Hệ phương trình', count: 2 },
          { name: 'Quy hoạch tuyến tính', count: 2 },
          { name: 'Lượng giác', count: 1 },
        ],
      },
      {
        name: 'Hình học',
        topics: [
          { name: 'Hinh học phẳng', count: 1 },
          { name: 'Hệ toạ độ Oxy', count: 3 },
          { name: 'Hệ toạ độ Oxyz', count: 2 },
          { name: 'Hình học không gian', count: 3 },
        ],
      },
      {
        name: 'Toán rời rạc và xác suất',
        topics: [
          { name: 'Xác suất', count: 3 },
          { name: 'Lý thuyết đồ thị', count: 2 },
        ],
      },
    ],
  },
  {
    code: 'TDKH',
    name: 'Tư duy khoa học',
    gomNhoms: [
      {
        name: 'Logic & PTSL',
        topics: [
          { name: 'Logic đơn nhóm', count: 3 },
          { name: 'Logic đa nhóm', count: 3 },
          { name: 'PTSL bảng', count: 3 },
          { name: 'PTSL biểu đồ', count: 3 },
        ],
      },
      {
        name: 'SLKH (KHTN)',
        topics: [
          { name: 'Lý', count: 3 },
          { name: 'Hoá', count: 3 },
          { name: 'Sinh', count: 3 },
        ],
      },
      {
        name: 'SLKH (KHXH)',
        topics: [
          { name: 'Địa', count: 3 },
          { name: 'Sử', count: 3 },
          { name: 'KTPL', count: 3 },
        ],
      },
    ],
  },
];

/**
 * Builds the complete 120-question structured hierarchy
 */
export function buildStandard120Structure(): ParsedKnowledgeStructure {
  let curQ = 1;
  const phanThis: PhanThiSection[] = [];
  const allDomains: DomainCategory[] = [];

  const PHAN_THI_THEMES = {
    TV: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-300',
      badgeBg: 'bg-amber-100 text-amber-800',
    },
    TA: {
      color: 'text-sky-600',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-300',
      badgeBg: 'bg-sky-100 text-sky-800',
    },
    TO: {
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-300',
      badgeBg: 'bg-indigo-100 text-indigo-800',
    },
    TDKH: {
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-300',
      badgeBg: 'bg-emerald-100 text-emerald-800',
    },
  };

  for (const pt of STANDARD_120_MATRIX) {
    const gomNhoms: DomainCategory[] = [];
    const ptQNums: number[] = [];
    const ptTopics: TopicItem[] = [];

    for (const gn of pt.gomNhoms) {
      const gnTopics: TopicItem[] = [];
      const gnQNums: number[] = [];

      for (const t of gn.topics) {
        const qNums: number[] = [];
        for (let c = 0; c < t.count; c++) {
          qNums.push(curQ);
          gnQNums.push(curQ);
          ptQNums.push(curQ);
          curQ++;
        }
        const topicItem: TopicItem = {
          name: t.name,
          count: t.count,
          qNums,
          subjectCode: pt.code,
          groupName: gn.name,
        };
        gnTopics.push(topicItem);
        ptTopics.push(topicItem);
      }

      const palette = paletteFor(gn.name, pt.code);
      const domCategory: DomainCategory = {
        domain: gn.name,
        subjectCode: pt.code,
        topics: gnTopics,
        qNums: gnQNums,
        total: gnQNums.length,
        ...palette,
      };

      gomNhoms.push(domCategory);
      allDomains.push(domCategory);
    }

    const theme = PHAN_THI_THEMES[pt.code];
    phanThis.push({
      code: pt.code,
      name: pt.name,
      gomNhoms,
      topics: ptTopics,
      qNums: ptQNums,
      total: ptQNums.length,
      ...theme,
    });
  }

  return {
    phanThis,
    domains: allDomains,
    totalQuestions: curQ - 1,
    is120Mode: true,
  };
}

/** Một dòng CSV đã chuẩn hoá: vùng kiến thức, chuyên đề và số câu. */
interface KnowledgeRow {
  domain: string;
  topic: string;
  count: number;
}

/**
 * Đọc `knowledge_structure.csv` thành danh sách chuyên đề có số thứ tự câu.
 *
 * Định dạng: cột 0 = Vùng kiến thức (chỉ ghi ở dòng đầu của vùng, các dòng sau để
 * trống → forward-fill), cột 1 = Chuyên đề, cột 2 = số câu. Cột 3 là số thứ tự câu
 * cuối của vùng và bị bỏ qua có chủ đích — nó thừa (đã suy ra được từ cột 2) và bị
 * sai ở vài vùng trong file mẫu, để lại dễ làm lệch toàn bộ đánh số câu phía sau.
 *
 * Dòng header và dòng trống (`,,,`) bị loại nhờ điều kiện `count > 0`.
 */
function readKnowledgeRows(csvText: string): KnowledgeRow[] {
  const rows: KnowledgeRow[] = [];
  let domain = '';
  for (const cells of parseCSVRows(csvText)) {
    const [rawDomain, rawTopic, rawCount] = cells;
    if (rawDomain && rawDomain.trim()) domain = rawDomain.trim();
    const topic = (rawTopic || '').trim();
    const count = parseInt((rawCount || '').trim(), 10);
    if (!topic) {
      if (Number.isFinite(count) && count > 0 && rows.length > 0) {
        // Handle split row continuation e.g. "Cấp số cộng/nhân, dãy số" (1 + 1 = 2)
        if (rows[rows.length - 1].count === 1 && count === 1) {
          rows[rows.length - 1].count = 2;
        }
      }
      continue;
    }
    if (!Number.isFinite(count) || count <= 0) continue;
    rows.push({ domain, topic, count });
  }
  return rows;
}

/** Gộp các chuyên đề liên tiếp cùng vùng thành `DomainCategory`, gán số câu 1..N. */
function buildDomainsFromRows(rows: KnowledgeRow[]): DomainCategory[] {
  const domains: DomainCategory[] = [];
  let curQ = 1;

  for (const row of rows) {
    const qNums: number[] = [];
    for (let k = 0; k < row.count; k++) qNums.push(curQ++);

    const last = domains[domains.length - 1];
    const topicItem: TopicItem = {
      name: row.topic,
      count: row.count,
      qNums,
      subjectCode: subjectOf(qNums[0]),
      groupName: row.domain,
    };

    if (last && last.domain === row.domain) {
      last.topics.push(topicItem);
      last.qNums.push(...qNums);
      last.total = last.qNums.length;
    } else {
      domains.push({
        domain: row.domain,
        subjectCode: topicItem.subjectCode,
        topics: [topicItem],
        // Phải sao chép: `last.qNums.push(...)` ở nhánh bên trên sẽ nối thêm các câu
        // của chuyên đề sau vào đây, và topicItem.qNums đang trỏ tới chính mảng này.
        qNums: [...qNums],
        total: row.count,
        ...paletteFor(row.domain, topicItem.subjectCode),
      });
    }
  }

  return domains;
}

/** Gom các vùng theo môn để dựng `phanThis`. */
function buildPhanThis(domains: DomainCategory[]): PhanThiSection[] {
  const themes: Record<SubjectCode, Omit<PhanThiSection, 'code' | 'name' | 'gomNhoms' | 'topics' | 'qNums' | 'total'>> = {
    TV: {
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-300',
      badgeBg: 'bg-amber-100 text-amber-800',
    },
    TA: {
      color: 'text-sky-600',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-300',
      badgeBg: 'bg-sky-100 text-sky-800',
    },
    TO: {
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-300',
      badgeBg: 'bg-indigo-100 text-indigo-800',
    },
    TDKH: {
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-300',
      badgeBg: 'bg-emerald-100 text-emerald-800',
    },
  };

  return SUBJECT_SEQUENCE
    .map(({ code }) => {
      const gomNhoms = domains.filter(d => d.subjectCode === code);
      const qNums = gomNhoms.flatMap(d => d.qNums);
      return {
        code,
        name: SUBJECT_NAME[code],
        gomNhoms,
        topics: gomNhoms.flatMap(d => d.topics),
        qNums,
        total: qNums.length,
        ...themes[code],
      } satisfies PhanThiSection;
    })
    .filter(p => p.total > 0);
}

/** Đánh số lại câu 1..N và cắt bỏ phần thi không nằm trong đề (dùng cho đề 60 câu Toán + TDKH). */
function keepSubjects(domains: DomainCategory[], codes: SubjectCode[]): DomainCategory[] {
  const kept = domains.filter(d => d.subjectCode && codes.includes(d.subjectCode));

  const renumber = new Map<number, number>();
  let curQ = 1;
  for (const d of kept) {
    for (const q of d.qNums) renumber.set(q, curQ++);
  }

  return kept.map(d => ({
    ...d,
    qNums: d.qNums.map(q => renumber.get(q)!),
    topics: d.topics.map(t => ({ ...t, qNums: t.qNums.map(q => renumber.get(q)!) })),
  }));
}

/**
 * Dựng ma trận kiến thức từ CSV.
 *
 * @param csvText         nội dung CSV (bỏ trống → dùng ma trận 120 câu hardcode)
 * @param examMaxQuestion số câu của đề thi; ≤ 60 thì chỉ giữ Toán + TDKH và đánh số lại
 */
export function parseKnowledgeCSV(csvText?: string, examMaxQuestion = 120): ParsedKnowledgeStructure {
  const is120Mode = examMaxQuestion > 60;
  const base = csvText?.trim()
    ? buildDomainsFromRows(readKnowledgeRows(csvText))
    : buildStandard120Structure().domains;

  const domains = is120Mode ? base : keepSubjects(base, ['TO', 'TDKH']);
  const phanThis = buildPhanThis(domains);

  return {
    phanThis,
    domains,
    totalQuestions: domains.reduce((sum, d) => sum + d.total, 0),
    is120Mode,
  };
}

const GLOBAL_STRUCTURE = buildStandard120Structure();

export interface QuestionKnowledgeDetail {
  qNum: number;
  subjectCode: 'TV' | 'TA' | 'TO' | 'TDKH';
  subjectName: string;
  groupName: string;
  topicName: string;
}

export function getQuestionKnowledgeInfo(qNum: number): QuestionKnowledgeDetail {
  for (const pt of GLOBAL_STRUCTURE.phanThis) {
    for (const gn of pt.gomNhoms) {
      for (const t of gn.topics) {
        if (t.qNums.includes(qNum)) {
          return {
            qNum,
            subjectCode: pt.code,
            subjectName: pt.name,
            groupName: gn.domain,
            topicName: t.name,
          };
        }
      }
    }
  }

  // Fallback based on question number ranges
  if (qNum <= 30) {
    return { qNum, subjectCode: 'TV', subjectName: 'Tiếng Việt', groupName: 'Tiếng Việt', topicName: 'Ngữ văn & Tiếng Việt' };
  } else if (qNum <= 60) {
    return { qNum, subjectCode: 'TA', subjectName: 'Tiếng Anh', groupName: 'Tiếng Anh', topicName: 'Ngữ pháp & Đọc hiểu' };
  } else if (qNum <= 90) {
    return { qNum, subjectCode: 'TO', subjectName: 'Toán học', groupName: 'Toán', topicName: 'Toán học' };
  } else {
    return { qNum, subjectCode: 'TDKH', subjectName: 'Tư duy khoa học', groupName: 'Khoa học', topicName: 'Tư duy khoa học' };
  }
}

/** Kết quả của một chuyên đề, đã gộp đúng/sai/bỏ trống để dùng chung ở nhiều màn hình. */
export interface TopicPerformance {
  code: SubjectCode;
  subjectName: string;
  groupName: string;
  name: string;
  total: number;
  correct: number;
  wrong: number;
  missing: number;
  pct: number;
  qNums: number[];
  wrongQs: number[];
  missingQs: number[];
}

export function getTopicPerformance(
  structure: ParsedKnowledgeStructure,
  responses?: { question_num: number; status: string }[],
): TopicPerformance[] {
  const wrongSet = new Set<number>();
  const missingSet = new Set<number>();
  for (const r of responses || []) {
    if (r.status === 'wrong') wrongSet.add(r.question_num);
    else if (r.status !== 'correct') missingSet.add(r.question_num);
  }

  const result: TopicPerformance[] = [];
  for (const pt of structure.phanThis) {
    for (const gn of pt.gomNhoms) {
      for (const topic of gn.topics) {
        const wrongQs = topic.qNums.filter(q => wrongSet.has(q));
        const missingQs = topic.qNums.filter(q => missingSet.has(q));
        const correct = Math.max(0, topic.count - wrongQs.length - missingQs.length);
        result.push({
          code: pt.code,
          subjectName: pt.name,
          groupName: gn.domain,
          name: topic.name,
          total: topic.count,
          correct,
          wrong: wrongQs.length,
          missing: missingQs.length,
          pct: topic.count > 0 ? Math.round((correct / topic.count) * 100) : 0,
          qNums: topic.qNums,
          wrongQs,
          missingQs,
        });
      }
    }
  }
  return result;
}

