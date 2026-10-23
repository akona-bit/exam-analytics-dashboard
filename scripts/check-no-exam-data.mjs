#!/usr/bin/env node
/**
 * Chặn dữ liệu thi / PII bị đưa vào Git.
 *
 * Dùng:
 *   node scripts/check-no-exam-data.mjs            # kiểm tra toàn bộ file đang track
 *   node scripts/check-no-exam-data.mjs --staged   # kiểm tra file sắp commit (pre-commit hook)
 *
 * Nguyên tắc: chỉ chặn theo tên/đường dẫn, không đọc nội dung, nên chạy rất nhanh.
 * Nếu file đã lỡ được track: git rm --cached <file> rồi kiểm tra lại.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const staged = process.argv.includes('--staged');

/** Các file cấu hình được phép track dù có đuôi dữ liệu. */
const ALLOWED = new Set(['knowledge_structure.csv']);

/** JSON cấu hình/dự án được phép track. */
const ALLOWED_JSON = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'metadata.json',
  'src/lib/referencePsychometrics.json',
]);

const FORBIDDEN_EXT = /\.(csv|xlsx|xls|xlsm|tsv|parquet|sqlite|sqlite3|db|pdf|zip|7z|aes)$/i;
const FORBIDDEN_JSON = /(^|\/)(response|api_data|question_texts)\.json$/i;
const FORBIDDEN_DIR = /(^|\/)(public\/data|dist\/data|exam-data|vault)\//i;
const FORBIDDEN_RAW = /(^|\/)raw_[^/]+$/i;
const FORBIDDEN_ENV = /(^|\/)\.env(\.|$)/i;

function isForbidden(file) {
  const p = file.replace(/\\/g, '/');
  if (ALLOWED.has(p) || ALLOWED_JSON.has(p)) return false;
  if (p === '.env.example') return false;
  if (FORBIDDEN_ENV.test(p)) return true;
  if (FORBIDDEN_EXT.test(p)) return true;
  if (FORBIDDEN_JSON.test(p)) return true;
  if (FORBIDDEN_DIR.test(p)) return true;
  if (FORBIDDEN_RAW.test(p)) return true;
  return false;
}

let files;
try {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z'];
  const out = execFileSync('git', args, {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  files = out.toString('utf8').split('\0').filter(Boolean);
} catch (error) {
  console.error('[check-no-exam-data] Không đọc được Git:', error.message);
  process.exit(2);
}

const forbidden = files.filter(isForbidden);

if (forbidden.length === 0) {
  console.log(
    staged
      ? '[check-no-exam-data] OK — không có dữ liệu thi trong commit này.'
      : '[check-no-exam-data] OK — không có dữ liệu thi nào đang được Git track.',
  );
  process.exit(0);
}

console.error('');
console.error('[check-no-exam-data] ĐÃ CHẶN: phát hiện dữ liệu thi/PII trong Git:');
for (const file of forbidden) console.error(`  - ${file}`);
console.error('');
console.error('Dữ liệu thi phải nằm trong vault ngoài repo: D:\\ExamDataVault');
console.error('Nếu file đã lỡ được track, bỏ khỏi index (không xóa file trên đĩa):');
console.error('  git rm --cached -- <file>');
console.error('');
console.error('Xem thêm: docs/DATA_VAULT.md');
process.exit(1);
