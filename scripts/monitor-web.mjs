#!/usr/bin/env node
/**
 * Monitor liên tục website: lỗi (console, uncaught, HTTP, request fail) và độ trễ
 * (TTFB, thời gian vào được dashboard, long task / TBT, thời gian đăng nhập và
 * chuyển tab nặng).
 *
 * Cách dùng:
 *   node scripts/monitor-web.mjs --once
 *   node scripts/monitor-web.mjs --interval 30 --duration 60
 *   node scripts/monitor-web.mjs --url http://localhost:3000 --no-interact
 *
 * Kết quả: .monitor/checks.jsonl (1 dòng / lần kiểm tra), .monitor/latest.json,
 * .monitor/summary.json, và ảnh chụp màn hình khi FAIL.
 */
import { createRequire } from 'node:module'
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/* ──────────── CLI ──────────── */

const argv = process.argv.slice(2)
const has = (n) => argv.includes(n)
const flag = (n, fallback) => {
  const i = argv.indexOf(n)
  return i === -1 ? fallback : argv[i + 1]
}

const OPTS = {
  url: flag('--url', 'https://ketquathithumitht.pages.dev'),
  intervalSec: Number(flag('--interval', 60)),
  durationMin: Number(flag('--duration', 0)), // 0 = chạy mãi tới khi Ctrl+C
  once: has('--once'),
  strict: has('--strict'),
  quiet: has('--quiet'),
  interact: !has('--no-interact'),
  adminEvery: Number(flag('--admin-every', 6)),
  timeout: Number(flag('--timeout', 45000)),
  readyTimeout: Number(flag('--ready-timeout', 20000)),
  slowReadyMs: Number(flag('--slow-ready', 6000)),
  slowTtfbMs: Number(flag('--slow-ttfb', 1200)),
  slowInteractionMs: Number(flag('--slow-interaction', 2500)),
  outDir: flag('--out', '.monitor'),
}

/** Thí sinh giữa bảng — tránh overlay vinh danh của top 1 gây nhiễu thao tác. */
const TEST_STUDENT = { name: 'Nguyen Tran Xuan Hoang', sbd: '210302' }

const HISTORY_FILE = join(OPTS.outDir, 'checks.jsonl')
const LATEST_FILE = join(OPTS.outDir, 'latest.json')
const SUMMARY_FILE = join(OPTS.outDir, 'summary.json')

/* ──────────── Chrome / patchright ──────────── */

function resolveChromium() {
  const roots = []
  for (const base of [join(homedir(), '.vscode-server/extensions'), join(homedir(), '.vscode/extensions')]) {
    if (!existsSync(base)) continue
    const dirs = readdirSync(base)
      .filter((d) => d.startsWith('danielsanmedium.dscodegpt-'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    const newest = dirs[dirs.length - 1]
    if (newest) roots.push(join(base, newest, 'standalone') + '/')
  }
  roots.push(process.cwd() + '/')
  for (const root of roots) {
    for (const pkg of ['patchright', 'playwright', 'playwright-core']) {
      try {
        const mod = createRequire(root)(pkg)
        const chromium = mod?.chromium ?? mod?.default?.chromium
        if (chromium) return chromium
      } catch {}
    }
  }
  throw new Error(
    'Không tìm thấy patchright/playwright. Đã thử:\n  ' +
      roots.join('\n  ') +
      '\nCài: npm i -D patchright && npx patchright install chromium',
  )
}

const chromium = resolveChromium()

/* ──────────── Helpers ──────────── */

const nowIso = () => new Date().toISOString()
const fmtMs = (ms) => (ms == null ? '-' : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`)

/** Console noise của SwiftShader/WebGL trong headless — không phải lỗi của app. */
const CONSOLE_NOISE =
  /GroupMarkerNotSet|Automatic fallback to software WebGL|CONTEXT_LOST_WEBGL|Failed to create WebGL|swiftshader|Third-party cookie|favicon\.ico/i

/** Analytics/ads bên thứ ba — không tính là lỗi của web. */
const HOST_NOISE = /(^|\.)(google|googletagmanager|google-analytics|doubleclick|facebook|segment|sentry|posthog|mixpanel)\./
const isNoiseUrl = (u) => {
  try {
    return HOST_NOISE.test(new URL(u).hostname)
  } catch {
    return false
  }
}

const short = (s, n = 220) => String(s).replace(/\s+/g, ' ').trim().slice(0, n)

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
}

function avg(values) {
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Cài observer ngay sau khi DOM committed. `buffered: true` trả lại cả long task /
 * LCP đã xảy ra trước đó, nên không cần chèn script trước khi app chạy.
 * (patchright của extension bỏ qua addInitScript, nên đây là cách duy nhất ổn định.)
 */
function installPerfObservers() {
  window.__perfMonitor = { longTasks: [], lcp: 0, cls: 0 }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perfMonitor.longTasks.push({ start: e.startTime, dur: e.duration })
    }).observe({ type: 'longtask', buffered: true })
  } catch {}
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) window.__perfMonitor.lcp = last.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perfMonitor.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}
}

/** Chạy trong page: tổng hợp performance + tài nguyên. */
function collectPerf() {
  const nav = performance.getEntriesByType('navigation')[0] || {}
  const paints = {}
  for (const p of performance.getEntriesByType('paint')) paints[p.name] = p.startTime

  const resources = performance.getEntriesByType('resource')
  let transferBytes = 0
  let decodedBytes = 0
  const slowest = []
  for (const r of resources) {
    transferBytes += r.transferSize || 0
    decodedBytes += r.decodedBodySize || 0
    slowest.push({ name: r.name.split('/').pop()?.split('?')[0] || r.name, ms: Math.round(r.duration), kb: Math.round((r.transferSize || 0) / 1024) })
  }
  slowest.sort((a, b) => b.ms - a.ms)

  const perf = window.__perfMonitor || { longTasks: [], lcp: 0, cls: 0 }
  const longTasks = perf.longTasks || []
  const tbt = longTasks.reduce((sum, t) => sum + Math.max(0, t.dur - 50), 0)
  const memory = performance.memory

  return {
    hasPerfMonitor: !!window.__perfMonitor,
    ttfbMs: nav.responseStart != null ? Math.round(nav.responseStart) : null,
    domContentLoadedMs: nav.domContentLoadedEventEnd != null ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadEventMs: nav.loadEventEnd != null ? Math.round(nav.loadEventEnd) : null,
    fcpMs: paints['first-contentful-paint'] != null ? Math.round(paints['first-contentful-paint']) : null,
    lcpMs: perf.lcp ? Math.round(perf.lcp) : null,
    cls: Number((perf.cls || 0).toFixed(4)),
    longTaskCount: longTasks.length,
    longTaskMaxMs: longTasks.length ? Math.round(Math.max(...longTasks.map((t) => t.dur))) : 0,
    totalBlockingMs: Math.round(tbt),
    heapMb: memory ? Number((memory.usedJSHeapSize / 1048576).toFixed(2)) : null,
    domNodes: document.getElementsByTagName('*').length,
    resourceCount: resources.length,
    transferKb: Math.round(transferBytes / 1024),
    decodedKb: Math.round(decodedBytes / 1024),
    slowestResources: slowest.slice(0, 5),
    bodyChars: (document.body?.innerText || '').trim().length,
  }
}

async function waitText(page, text, timeout) {
  // innerText chịu ảnh hưởng của text-transform:uppercase — so sánh không phân biệt hoa thường.
  await page.waitForFunction(
    (t) => (document.body?.innerText || '').toLowerCase().includes(t.toLowerCase()),
    text,
    { timeout },
  )
}

async function waitAnyText(page, texts, timeout) {
  await page.waitForFunction(
    (list) => {
      const body = (document.body?.innerText || '').toLowerCase()
      return list.some((t) => body.includes(t.toLowerCase()))
    },
    texts,
    { timeout },
  )
}

/** Bấm nút đầu tiên khớp một trong các nhãn — chịu được việc đổi nhãn giữa các bản build. */
async function clickAnyLabel(page, labels, timeout = 10000) {
  for (const label of labels) {
    const button = page.locator(`button:has-text("${label}")`).first()
    if (await button.isVisible().catch(() => false)) {
      await button.click()
      return label
    }
  }
  const button = page
    .locator('button')
    .filter({ hasText: new RegExp(labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')) })
    .first()
  await button.waitFor({ state: 'visible', timeout })
  await button.click()
  return labels[0]
}

/* ──────────── Một lần kiểm tra ──────────── */

async function runCheck(browser, checkNo) {
  const startedAt = nowIso()
  const context = await browser.newContext({
    locale: 'vi-VN',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  const consoleErrors = []
  const consoleWarnings = []
  const pageErrors = []
  const requestFailures = []
  const httpErrors = []

  page.on('console', (m) => {
    const text = m.text()
    if (CONSOLE_NOISE.test(text)) return
    if (m.type() === 'error') consoleErrors.push(short(text))
    else if (m.type() === 'warning') consoleWarnings.push(short(text))
  })
  page.on('pageerror', (e) => pageErrors.push(short(e?.message || e)))
  page.on('requestfailed', (r) => {
    if (isNoiseUrl(r.url())) return
    const reason = r.failure()?.errorText || 'failed'
    // Navigation bị huỷ khi chuyển trang là bình thường.
    if (/ERR_ABORTED/.test(reason)) return
    requestFailures.push(short(`${reason} ${r.url()}`, 260))
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && !isNoiseUrl(r.url())) httpErrors.push({ status: r.status(), url: short(r.url(), 260) })
  })

  const result = {
    check: checkNo,
    startedAt,
    url: OPTS.url,
    status: 'ok',
    httpStatus: null,
    navError: null,
    ready: false,
    readyMs: null,
    appState: null,
    load: null,
    interaction: null,
    admin: null,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    requestFailures,
    httpErrors,
    screenshot: null,
    problems: [],
    warnings: [],
  }

  const t0 = Date.now()
  try {
    const resp = await page.goto(OPTS.url, { waitUntil: 'domcontentloaded', timeout: OPTS.timeout })
    result.httpStatus = resp?.status() ?? null
  } catch (e) {
    result.navError = short(e?.message || e, 300)
  }

  if (!result.navError) {
    // Observer phải cài trước khi app render màn hình kết quả; buffered lấy lại
    // long task / LCP đã xảy ra trong lúc tải.
    await page.evaluate(installPerfObservers).catch(() => {})
    // Bỏ qua modal "Thư Cảm Ơn" (chỉ hiện lần đầu) để đo dashboard, không đo modal.
    await page
      .evaluate((sbd) => {
        try {
          localStorage.setItem(`mit_thank_you_seen_${sbd}`, 'true')
        } catch {}
      }, TEST_STUDENT.sbd)
      .catch(() => {})
    try {
      await page.waitForSelector('#lookup-name', { state: 'visible', timeout: OPTS.readyTimeout })
      result.ready = true
      result.readyMs = Date.now() - t0
    } catch {
      const state = await page
        .evaluate(() => ({
          body: (document.body?.innerText || '').slice(0, 800),
          rootLen: (document.getElementById('root')?.innerHTML || '').trim().length,
        }))
        .catch(() => ({ body: '', rootLen: -1 }))
      result.appState = /Không tải được dữ liệu/i.test(state.body)
        ? 'load-error'
        : /Đang chuẩn bị dữ liệu|Đang tải dữ liệu/i.test(state.body)
          ? 'stuck-loading'
          : state.rootLen === 0
            ? 'blank-page'
            : 'no-ui'
      result.rootHtmlLen = state.rootLen
      result.bodyPreview = short(state.body, 300)
    }
  }

  // Cho chart/animation ổn định rồi mới đo long task + tài nguyên.
  await page.waitForTimeout(1200)
  result.load = await page.evaluate(collectPerf).catch(() => null)

  /* ── Tương tác: đăng nhập + chuyển tab nặng ── */
  if (result.ready && OPTS.interact) {
    const interaction = { suggestMs: null, loginMs: null, reviewMs: null, classMs: null, error: null }
    try {
      const t = Date.now()
      await page.fill('#lookup-name', TEST_STUDENT.name)
      // Gợi ý đổi từ nút "Chọn thí sinh" (bản cũ) sang danh sách tên + nhãn "Chọn".
      // Không bắt buộc phải bấm gợi ý: nhập tay tên + SBD vẫn đăng nhập được.
      const suggestion = page
        .locator('button:has-text("Chọn")')
        .filter({ hasText: TEST_STUDENT.name })
        .first()
      const hasSuggestion = await suggestion
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false)
      if (hasSuggestion) await suggestion.click({ timeout: 5000 }).catch(() => {})
      interaction.suggestMs = Date.now() - t

      const tLogin = Date.now()
      await page.fill('#lookup-password', TEST_STUDENT.sbd)
      await page.locator('button[type="submit"]').click()
      await waitAnyText(page, ['ĐIỂM NEO ĐỀ', 'Bảng Điểm Neo Đề', 'Tổng quan'], 15000)
      interaction.loginMs = Date.now() - tLogin

      // Modal "Thư Cảm Ơn" tự bật sau khi đăng nhập và chặn thao tác — đóng nó.
      const thankYou = page.locator('button:has-text("Xem Kết Quả & Phân Tích Của Tôi")').first()
      const hasThankYou = await thankYou
        .waitFor({ state: 'visible', timeout: 4000 })
        .then(() => true)
        .catch(() => false)
      if (hasThankYou) {
        await thankYou.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(500)
      }

      const tReview = Date.now()
      await clickAnyLabel(page, ['Bài làm & kiến thức', 'Câu Hỏi & Vùng Kiến Thức'])
      await waitAnyText(page, ['Bản đồ 120 câu', 'Bảng Trạng Thái Toàn Bộ Đề Thi', 'Chi tiết toàn bộ'], 15000)
      interaction.reviewMs = Date.now() - tReview

      const tClass = Date.now()
      await clickAnyLabel(page, ['Toàn khóa', 'Thống Kê Toàn Khóa'])
      // Lazy-load chunk ClassAnalytics (mặc định mở tab "Phân Tích Câu Hỏi").
      await waitText(page, 'Phân Tích Câu Hỏi & Độ Phân Hóa Đề Thi', 25000)
      interaction.classChunkMs = Date.now() - tClass
      // Tab nặng nhất: KPI + histogram + donut + scatter.
      await page.locator('button:has-text("Phổ Điểm & Năng Lực")').first().click()
      await waitText(page, 'Tổng Thí Sinh', 15000)
      interaction.classMs = Date.now() - tClass
    } catch (e) {
      interaction.error = short(e?.message || e, 300)
      interaction.uiText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 500)).catch(() => '')
    }
    result.interaction = interaction

    // Long task sau tương tác (bao gồm cả lúc render chart).
    const after = await page.evaluate(collectPerf).catch(() => null)
    if (after) {
      result.interactionLongTasks = after.longTaskCount
      result.interactionBlockingMs = after.totalBlockingMs
      result.interactionHeapMb = after.heapMb
    }
  }

  /* ── Kiểm tra #admin định kỳ ── */
  if (checkNo % OPTS.adminEvery === 0) {
    const admin = { ok: false, ms: null, error: null }
    try {
      const u = new URL(OPTS.url)
      u.hash = 'admin'
      const t = Date.now()
      await page.goto(u.toString(), { waitUntil: 'domcontentloaded', timeout: OPTS.timeout })
      await waitText(page, 'Admin Login', 15000)
      admin.ok = true
      admin.ms = Date.now() - t
    } catch (e) {
      admin.error = short(e?.message || e, 260)
    }
    result.admin = admin
  }

  result.durationMs = Date.now() - t0

  /* ── Đánh giá ── */
  if (result.navError) result.problems.push(`Không mở được trang: ${result.navError}`)
  if (result.httpStatus && result.httpStatus >= 400) result.problems.push(`HTTP ${result.httpStatus} khi tải trang`)
  if (result.pageErrors.length) result.problems.push(`${result.pageErrors.length} lỗi JS chưa bắt (uncaught)`)
  if (result.consoleErrors.length) result.problems.push(`${result.consoleErrors.length} console.error`)
  if (!result.ready && !result.navError) result.problems.push(`UI không sẵn sàng (${result.appState})`)
  if (result.interaction?.error) result.problems.push(`Thao tác thất bại: ${result.interaction.error}`)
  if (result.admin && !result.admin.ok) result.problems.push(`Không mở được #admin: ${result.admin.error}`)

  const serverErrors = result.httpErrors.filter((e) => e.status >= 500)
  if (serverErrors.length) result.problems.push(`${serverErrors.length} response 5xx`)
  const notFound = result.httpErrors.filter((e) => e.status === 404)
  if (notFound.length) result.warnings.push(`${notFound.length} response 404`)
  if (result.requestFailures.length) result.warnings.push(`${result.requestFailures.length} request fail`)
  if (result.consoleWarnings.length) result.warnings.push(`${result.consoleWarnings.length} console.warning`)

  const load = result.load
  if (load) {
    if (load.ttfbMs != null && load.ttfbMs > OPTS.slowTtfbMs) result.warnings.push(`TTFB chậm: ${fmtMs(load.ttfbMs)}`)
    if (load.lcpMs != null && load.lcpMs > 4000) result.warnings.push(`LCP chậm: ${fmtMs(load.lcpMs)}`)
    if (load.totalBlockingMs > 800) result.warnings.push(`TBT cao: ${fmtMs(load.totalBlockingMs)}`)
    if (load.transferKb > 6000) result.warnings.push(`Tải nặng: ${Math.round(load.transferKb / 1024)}MB`)
  }
  if (result.readyMs != null && result.readyMs > OPTS.slowReadyMs)
    result.warnings.push(`Vào dashboard chậm: ${fmtMs(result.readyMs)}`)
  if (result.readyMs != null && result.readyMs > OPTS.readyTimeout)
    result.problems.push(`Dashboard treo > ${fmtMs(OPTS.readyTimeout)}`)

  for (const key of ['loginMs', 'reviewMs', 'classMs']) {
    const v = result.interaction?.[key]
    if (v != null && v > OPTS.slowInteractionMs)
      result.warnings.push(`${key.replace('Ms', '')} chậm: ${fmtMs(v)}`)
  }
  if (result.interaction?.suggestMs > 1000) result.warnings.push(`Gợi ý tên chậm: ${fmtMs(result.interaction.suggestMs)}`)

  result.status = result.problems.length ? 'fail' : result.warnings.length ? 'warn' : 'ok'

  if (result.status === 'fail') {
    result.debug = await page
      .evaluate(() => {
        const splash = document.querySelector('.initial-splash')
        return {
          href: location.href,
          readyState: document.readyState,
          bodyClass: document.body.className,
          bodyHtmlLen: document.body.innerHTML.length,
          rootHtml: (document.getElementById('root')?.innerHTML || '').slice(0, 1200),
          splashDisplay: splash ? getComputedStyle(splash).display : 'missing',
        }
      })
      .catch((e) => ({ debugError: String(e) }))
    try {
      const file = join(OPTS.outDir, `fail-${startedAt.replace(/[:.]/g, '-')}.png`)
      await page.screenshot({ path: file, fullPage: false })
      result.screenshot = file
    } catch {}
  }

  await context.close()
  return result
}

/* ──────────── In + lưu ──────────── */

function logLine(r) {
  const tag = r.status.toUpperCase().padStart(4)
  const load = r.load || {}
  const i = r.interaction || {}
  const parts = [
    `#${String(r.check).padStart(3, '0')}`,
    tag,
    `http=${r.httpStatus ?? '-'}`,
    `ready=${fmtMs(r.readyMs)}`,
    `ttfb=${fmtMs(load.ttfbMs)}`,
    `fcp=${fmtMs(load.fcpMs)}`,
    `lcp=${fmtMs(load.lcpMs)}`,
    `tbt=${fmtMs(load.totalBlockingMs)}`,
    `login=${fmtMs(i.loginMs)}`,
    `class=${fmtMs(i.classMs)}`,
    `err=${r.consoleErrors.length + r.pageErrors.length}`,
    `warn=${r.consoleWarnings.length}`,
    `net=${r.requestFailures.length + r.httpErrors.length}`,
  ]
  if (r.status !== 'ok') {
    for (const p of r.problems) parts.push(`\n      ! ${p}`)
    for (const w of r.warnings) parts.push(`\n      ~ ${w}`)
  }
  return `[${new Date().toLocaleTimeString('vi-VN')}] ${parts.join(' ')}`
}

function summarize(results) {
  const ok = results.filter((r) => r.status === 'ok').length
  const warn = results.filter((r) => r.status === 'warn').length
  const fail = results.filter((r) => r.status === 'fail').length
  const num = (get) => results.map(get).filter((v) => typeof v === 'number')
  return {
    updatedAt: nowIso(),
    checks: results.length,
    ok,
    warn,
    fail,
    uptimePct: results.length ? Number(((ok / results.length) * 100).toFixed(1)) : null,
    readyMs: { avg: avg(num((r) => r.readyMs)), p95: percentile(num((r) => r.readyMs), 95), max: Math.max(0, ...num((r) => r.readyMs)) },
    ttfbMs: { avg: avg(num((r) => r.load?.ttfbMs)), p95: percentile(num((r) => r.load?.ttfbMs), 95) },
    lcpMs: { avg: avg(num((r) => r.load?.lcpMs)), p95: percentile(num((r) => r.load?.lcpMs), 95) },
    tbtMs: { avg: avg(num((r) => r.load?.totalBlockingMs)), p95: percentile(num((r) => r.load?.totalBlockingMs), 95) },
    loginMs: { avg: avg(num((r) => r.interaction?.loginMs)), p95: percentile(num((r) => r.interaction?.loginMs), 95) },
    classMs: { avg: avg(num((r) => r.interaction?.classMs)), p95: percentile(num((r) => r.interaction?.classMs), 95) },
  }
}

function printSummary(results) {
  const s = summarize(results)
  console.log('\n──────── TỔNG KẾT ────────')
  console.log(
    `Lần kiểm tra: ${s.checks} | OK: ${s.ok} | WARN: ${s.warn} | FAIL: ${s.fail} | Uptime: ${s.uptimePct ?? '-'}%`,
  )
  console.log(
    `ready avg/p95: ${fmtMs(s.readyMs.avg)} / ${fmtMs(s.readyMs.p95)} | TTFB avg/p95: ${fmtMs(s.ttfbMs.avg)} / ${fmtMs(s.ttfbMs.p95)}`,
  )
  console.log(
    `LCP avg/p95: ${fmtMs(s.lcpMs.avg)} / ${fmtMs(s.lcpMs.p95)} | TBT avg/p95: ${fmtMs(s.tbtMs.avg)} / ${fmtMs(s.tbtMs.p95)}`,
  )
  console.log(
    `login avg/p95: ${fmtMs(s.loginMs.avg)} / ${fmtMs(s.loginMs.p95)} | tab lớp avg/p95: ${fmtMs(s.classMs.avg)} / ${fmtMs(s.classMs.p95)}`,
  )
  console.log(`Chi tiết: ${HISTORY_FILE}`)
}

/* ──────────── Vòng lặp ──────────── */

mkdirSync(OPTS.outDir, { recursive: true })

let browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})

const results = []
const deadline = OPTS.durationMin > 0 ? Date.now() + OPTS.durationMin * 60_000 : Infinity
let checkNo = 0
let stopping = false

async function stop(code = 0) {
  stopping = true
  try {
    await browser?.close()
  } catch {}
  writeFileSync(SUMMARY_FILE, JSON.stringify(summarize(results), null, 2))
  printSummary(results)
  process.exit(code)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

if (!OPTS.quiet) {
  console.log(`Giám sát ${OPTS.url}`)
  console.log(
    `Mỗi ${OPTS.intervalSec}s${OPTS.durationMin ? ` trong ${OPTS.durationMin} phút` : ' (Ctrl+C để dừng)'} | tương tác: ${OPTS.interact ? 'có' : 'không'} | log: ${HISTORY_FILE}\n`,
  )
}

while (!stopping) {
  checkNo += 1
  let result
  try {
    result = await runCheck(browser, checkNo)
  } catch (e) {
    result = {
      check: checkNo,
      startedAt: nowIso(),
      url: OPTS.url,
      status: 'fail',
      problems: [`Monitor crash: ${short(e?.stack || e, 400)}`],
      warnings: [],
      consoleErrors: [],
      consoleWarnings: [],
      pageErrors: [],
      requestFailures: [],
      httpErrors: [],
    }
  }

  results.push(result)
  appendFileSync(HISTORY_FILE, JSON.stringify(result) + '\n')
  writeFileSync(LATEST_FILE, JSON.stringify(result, null, 2))
  const summary = summarize(results)
  writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2))

  if (!OPTS.quiet || result.status !== 'ok') console.log(logLine(result))
  if (result.status === 'fail') {
    const consecutive = results.slice(-3).filter((r) => r.status === 'fail').length
    if (consecutive >= 3) console.log(`      ⚠ ${consecutive} lần FAIL liên tiếp — kiểm tra ngay.`)
  }

  if (OPTS.once) {
    await stop(result.status === 'fail' || (OPTS.strict && result.status === 'warn') ? 1 : 0)
  }

  // Khởi động lại browser định kỳ để tránh rò rỉ bộ nhớ của tiến trình monitor.
  if (checkNo % 60 === 0) {
    try {
      await browser.close()
    } catch {}
    browser = await chromium.launch({
      headless: true,
      channel: 'chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
    })
  }

  if (Date.now() + OPTS.intervalSec * 1000 > deadline) break
  await new Promise((r) => setTimeout(r, OPTS.intervalSec * 1000))
}

await stop(0)
