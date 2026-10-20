#!/usr/bin/env node
/**
 * Đọc log giám sát (.monitor/checks.jsonl) và in báo cáo gọn.
 *
 *   node scripts/monitor-report.mjs                # toàn bộ log
 *   node scripts/monitor-report.mjs --last 20      # 20 lần gần nhất
 *   node scripts/monitor-report.mjs --last 2h      # 2 giờ gần nhất
 *   node scripts/monitor-report.mjs --json         # xuất JSON
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (n, d) => {
  const i = argv.indexOf(n)
  return i === -1 ? d : argv[i + 1]
}

const file = flag('--file', '.monitor/checks.jsonl')
if (!existsSync(file)) {
  console.error(`Chưa có log: ${file}\nChạy: npm run monitor`)
  process.exit(1)
}

const all = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })
  .filter(Boolean)

let rows = all
const last = flag('--last')
if (last) {
  if (/^\d+$/.test(last)) rows = all.slice(-Number(last))
  else {
    const m = last.match(/^(\d+)([mhd])$/)
    if (m) {
      const ms = Number(m[1]) * { m: 60e3, h: 3600e3, d: 86400e3 }[m[2]]
      rows = all.filter((r) => Date.now() - new Date(r.startedAt).getTime() <= ms)
    }
  }
}

const num = (get) => rows.map(get).filter((v) => typeof v === 'number')
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null)
const pct = (a, p) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)] : null
const max = (a) => (a.length ? Math.max(...a) : null)
const fmt = (ms) => (ms == null ? '-' : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`)

const ok = rows.filter((r) => r.status === 'ok').length
const warn = rows.filter((r) => r.status === 'warn').length
const fail = rows.filter((r) => r.status === 'fail').length
const ready = num((r) => r.readyMs)
const ttfb = num((r) => r.load?.ttfbMs)
const lcp = num((r) => r.load?.lcpMs)
const tbt = num((r) => r.load?.totalBlockingMs)
const login = num((r) => r.interaction?.loginMs)
const classTab = num((r) => r.interaction?.classMs)

const summary = {
  file,
  firstCheck: rows[0]?.startedAt ?? null,
  lastCheck: rows.at(-1)?.startedAt ?? null,
  checks: rows.length,
  ok,
  warn,
  fail,
  uptimePct: rows.length ? Number(((ok / rows.length) * 100).toFixed(1)) : null,
  readyMs: { avg: avg(ready), p95: pct(ready, 95), max: max(ready) },
  ttfbMs: { avg: avg(ttfb), p95: pct(ttfb, 95), max: max(ttfb) },
  lcpMs: { avg: avg(lcp), p95: pct(lcp, 95), max: max(lcp) },
  totalBlockingMs: { avg: avg(tbt), p95: pct(tbt, 95), max: max(tbt) },
  loginMs: { avg: avg(login), p95: pct(login, 95), max: max(login) },
  classTabMs: { avg: avg(classTab), p95: pct(classTab, 95), max: max(classTab) },
}

// Vấn đề lặp lại nhiều nhất (bỏ số đếm đầu dòng để gộp cùng loại lỗi).
const problemCounts = new Map()
for (const r of rows) {
  for (const p of r.problems || []) {
    const key = p.replace(/^\d+\s/, '').slice(0, 160)
    problemCounts.set(key, (problemCounts.get(key) || 0) + 1)
  }
}
const topProblems = [...problemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

const slowest = [...rows]
  .filter((r) => typeof r.readyMs === 'number')
  .sort((a, b) => b.readyMs - a.readyMs)
  .slice(0, 5)
  .map((r) => ({ at: r.startedAt, readyMs: r.readyMs, ttfbMs: r.load?.ttfbMs, status: r.status }))

const failures = rows
  .filter((r) => r.status === 'fail')
  .slice(-10)
  .map((r) => ({ at: r.startedAt, problems: r.problems, screenshot: r.screenshot }))

const report = { summary, topProblems, slowest, failures }

if (argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(fail ? 1 : 0)
}

console.log(`\nLog: ${file}`)
console.log(`Khoảng: ${summary.firstCheck ?? '-'} → ${summary.lastCheck ?? '-'}`)
console.log(`\nLần kiểm tra : ${summary.checks}`)
console.log(`OK / WARN / FAIL: ${ok} / ${warn} / ${fail}   (uptime ${summary.uptimePct}%)`)
console.log('\nĐộ trễ (avg / p95 / max)')
const line = (label, s) => console.log(`  ${label.padEnd(16)} ${fmt(s.avg).padStart(8)} / ${fmt(s.p95).padStart(8)} / ${fmt(s.max).padStart(8)}`)
line('Vào dashboard', summary.readyMs)
line('TTFB', summary.ttfbMs)
line('LCP', summary.lcpMs)
line('TBT', summary.totalBlockingMs)
line('Đăng nhập', summary.loginMs)
line('Tab toàn khóa', summary.classTabMs)

if (topProblems.length) {
  console.log('\nVấn đề lặp lại')
  for (const [p, n] of topProblems) console.log(`  ${String(n).padStart(3)}×  ${p}`)
}

if (slowest.length) {
  console.log('\nChậm nhất')
  for (const s of slowest) console.log(`  ${fmt(s.readyMs).padStart(8)}  ${s.at}  (${s.status})`)
}

if (failures.length) {
  console.log(`\nFAIL gần nhất (${failures.length})`)
  for (const f of failures) {
    console.log(`  ${f.at}`)
    for (const p of f.problems || []) console.log(`    ! ${p}`)
    if (f.screenshot) console.log(`    ảnh: ${f.screenshot}`)
  }
}

console.log('')
process.exit(fail ? 1 : 0)
