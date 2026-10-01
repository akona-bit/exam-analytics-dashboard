# Project Memory — Kết Quả Khảo Sát (Exam Analytics Dashboard)

## Project Overview
- React 19 + TypeScript + Vite + Tailwind v4 + Recharts SPA
- Exam score lookup & analytics dashboard (Toán + TDKH)
- 702 students, 60 questions, multiple exam attempts
- Express backend (dev) / static JSON (production)
- Deployed to Cloudflare Pages as `ket-qua-khao-sat` (separate from `mit-exams` project)

## Deployment
- Cloudflare Pages project: `ket-qua-khao-sat` (NOT `mit-exams` — that is a different project)
- Production URL: https://ket-qua-khao-sat.pages.dev
- Build: `npm run build:static` (exports data JSON + Vite build)
- Deploy: `npx wrangler pages deploy dist --project-name ket-qua-khao-sat`
- Static fallback: App.tsx fetches `/api/*` first, falls back to `data/*.json`

## Key Conventions
- 3 score metrics: `tho` (raw), `irt` (IRT), `thuongPhat` (bonus/penalty)
- 2 subjects: `toan` (Math), `tdkh` (Scientific Thinking)
- Max 25 pts/subject, 50 total
- Câu 4 flagged as `isError` (LỖI ĐỀ THI)
- Students with multiple attempts grouped by email/name, latest attempt used for ranking
- UI colors: indigo=primary, rose=errors, amber=penalty/missing, emerald=correct/good
