/**
 * Trích xuất thông số tâm trắc (IRT) từ file dashboard tham chiếu
 * `Dashboard_thi_thu_2027_lan_1_no_total_stacked_bar.html`.
 *
 * File tham chiếu chứa sẵn object `D` gồm:
 *  - items: 120 câu với p, a, b, D-index, infit, outfit, nhóm kiến thức, obs.
 *  - cands: 625 thí sinh với điểm từng phần, hạng, năng lực theta, số câu đúng.
 *
 * Kết quả ghi ra `src/lib/referencePsychometrics.json` (được commit) để app
 * dùng mà không phụ thuộc file HTML lúc chạy.
 *
 * Chạy: node scripts/extract-reference-psychometrics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'Dashboard_thi_thu_2027_lan_1_no_total_stacked_bar.html');
const outPath = path.join(root, 'src', 'lib', 'referencePsychometrics.json');

if (!fs.existsSync(htmlPath)) {
  console.error(`Không tìm thấy file tham chiếu: ${htmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const D=');
const end = html.indexOf('const SEC=', start);
if (start < 0 || end < 0) {
  console.error('Không tìm thấy object D trong file tham chiếu.');
  process.exit(1);
}

const raw = html.slice(start + 'const D='.length, end).trim().replace(/;\s*$/, '');
const D = JSON.parse(raw);

const masters = (D.masters || []).map(String);

const items = D.items.map((it) => ({
  id: it.id,
  s: it.s,
  p: it.p,
  a: it.a,
  b: it.b,
  d: it.d,
  inf: it.inf,
  out: it.out,
  g: it.g,
  k: it.k,
  obs: it.obs,
}));

const students = {};
for (const c of D.cands) {
  const sbd = String(c[0]);
  students[sbd] = {
    theta: c[7],
    correct: c[8],
    sectionScores: c[4],
    total: c[5],
    rank: c[6],
  };
}

const output = {
  source: path.basename(htmlPath),
  masters,
  items,
  students,
};

fs.writeFileSync(outPath, JSON.stringify(output), 'utf8');
const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Đã ghi ${outPath} (${sizeKb} KB): ${items.length} câu · ${Object.keys(students).length} thí sinh.`);
