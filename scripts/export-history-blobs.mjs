#!/usr/bin/env node
/**
 * Trích xuất MỌI phiên bản của file dữ liệu thi từ toàn bộ lịch sử Git
 * (mọi commit, mọi ref) ra một thư mục vault, trước khi rewrite lịch sử.
 *
 * Dùng:
 *   node scripts/export-history-blobs.mjs <repoRoot> <outDir>
 *
 * Kết quả:
 *   <outDir>/<sha>/<đường-dẫn-gốc>   nội dung từng blob
 *   <outDir>/manifest.json            danh sách blob + kích thước
 *   <outDir>/unique-paths.txt         các đường dẫn từng chứa dữ liệu thi
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(process.argv[2] || '.');
const outDir = path.resolve(process.argv[3] || path.join(repoRoot, 'history-blobs'));

const ALLOWED = new Set(['knowledge_structure.csv']);
const FORBIDDEN_EXT = /\.(csv|xlsx|xls|xlsm|tsv|parquet|sqlite|sqlite3|db|pdf|zip|7z|aes)$/i;
const FORBIDDEN_JSON = /(^|\/)(response|api_data|question_texts)\.json$/i;
const FORBIDDEN_DIR = /(^|\/)(public\/data|dist\/data|exam-data|vault)\//i;
const FORBIDDEN_RAW = /(^|\/)raw_[^/]+$/i;

function isSensitive(file) {
  const p = file.replace(/\\/g, '/');
  if (ALLOWED.has(p)) return false;
  return (
    FORBIDDEN_EXT.test(p) ||
    FORBIDDEN_JSON.test(p) ||
    FORBIDDEN_DIR.test(p) ||
    FORBIDDEN_RAW.test(p)
  );
}

function safeRelativePath(file) {
  const normalized = path.normalize(file).replace(/^([/\\])+/, '');
  const parts = normalized.split(/[\\/]+/).filter((part) => part && part !== '.' && part !== '..');
  return parts.join(path.sep);
}

const revList = execFileSync('git', ['rev-list', '--objects', '--all'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});

const seen = new Set();
const entries = [];
const uniquePaths = new Set();

for (const line of revList.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const space = line.indexOf(' ');
  if (space === -1) continue; // commit object, không có path
  const sha = line.slice(0, space);
  const file = line.slice(space + 1);
  if (!isSensitive(file)) continue;

  const key = `${sha}\0${file}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniquePaths.add(file);

  const rel = safeRelativePath(file);
  if (!rel) continue;
  const dest = path.join(outDir, sha, rel);
  if (fs.existsSync(dest)) continue;

  let bytes;
  try {
    bytes = execFileSync('git', ['cat-file', 'blob', sha], {
      cwd: repoRoot,
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (error) {
    console.warn(`[export-history-blobs] bỏ qua ${sha} ${file}: ${error.message}`);
    continue;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  entries.push({ sha, path: file, bytes: bytes.length, savedAs: path.relative(outDir, dest) });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      repoRoot,
      totalBlobs: entries.length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      uniquePaths: [...uniquePaths].sort(),
      entries,
    },
    null,
    2,
  ),
);
fs.writeFileSync(path.join(outDir, 'unique-paths.txt'), [...uniquePaths].sort().join('\n') + '\n');

console.log(
  `[export-history-blobs] ${entries.length} blob, ${(entries.reduce((s, e) => s + e.bytes, 0) / 1024).toFixed(1)} KB -> ${outDir}`,
);
