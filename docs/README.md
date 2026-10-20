# Exam Analytics Dashboard — Documentation

This folder contains the technical (English-language) documentation for the **exam-analytics-dashboard** project
(a.k.a. *"Kết Quả Thi THPT — Bảng Điều Khiển Tra Cứu & Phân Tích Điểm"*).

The user-facing README (`README.md`, Vietnamese) remains the product/feature reference. These docs are aimed at
developers and operators who need to understand, extend, deploy, or maintain the codebase.

## What this project is

A client-first web app that lets students look up their exam results and teachers analyze cohort results for a
single survey/exam sitting ("Kì Thi Thử ĐGNL"). It shows raw scores, IRT standardized scores, reward/penalty
scoring, per-question difficulty analysis, a knowledge-topic matrix, ranking tables, histograms, scatter plots,
and PDF export of individual score sheets.

## Documentation index

| Document | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Tech stack, system architecture, data flow, project structure |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Local setup, npm scripts, data pipeline, component reference, conventions |
| [`DATA_MODEL.md`](DATA_MODEL.md) | TypeScript types, CSV schemas, Supabase schema, RLS policies |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deploy to Cloudflare Pages, CI, environment variables, security notes |

## Quick links

- Live site: <https://ketquathithumitht.pages.dev>
- Source repository: <https://github.com/akona-bit/exam-analytics-dashboard>
- Package manager: **npm** only (`package-lock.json` is the single lockfile; `bun.lock` was removed)

## Language notes

- UI text and most inline comments are in **Vietnamese**.
- This documentation is in **English**.
- Source file names and identifiers use English (e.g. `Dashboard.tsx`, `csvParser.ts`, `toan`, `tdkh` for subject
  codes — see `DATA_MODEL.md` for the subject code table).
