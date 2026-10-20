# Architecture

## Runtime

The application is a React 19 + TypeScript single page app built with Vite. `src/main.tsx` mounts `src/App.tsx`; the app loads exam data from Supabase when configured and can fall back to static JSON under `public/data/` or the local Express API. The deployed Cloudflare Pages build is static; `server/server.ts` is a separate local/Node runtime, not a Pages Function.

```text
CSV source files ──> csvParser ──> export-data ──> public/data/*.json ──> Vite static build
       │                  ├─────> import-supabase ──> Supabase
       └──────────────────┴─────> Express /api (local server)
                                      │
React app <── Supabase / static JSON / local API
```

## Main areas

- `src/components/dashboard/`: student score profile, question analysis, and cohort analytics.
- `src/components/admin/`: admin interface for managing and uploading exam data.
- `src/lib/`: CSV parsing, analytics, exam-code mapping, knowledge structure, and Supabase client.
- `scripts/`: dataset generation, static export, data processing, and Supabase import utilities.
- `db/`: SQL schema and migration/verification scripts.
- `public/`: static assets and generated JSON data (when source CSVs are available).
- `server/server.ts`: Express API that loads the source CSVs into memory; in development it also mounts Vite middleware.

## Data flow

`src/App.tsx` coordinates data loading and routes between the student lookup and admin views. CSV interpretation is centralized in `src/lib/csvParser.ts` so the Express API, static exporter, and Supabase importer share the same parsing rules. Analytics and chart-ready calculations live primarily in `src/lib/analytics.ts` and dashboard components. PDF creation is handled in the student dashboard with `html2canvas-pro` and `jspdf`.

When building a static deployment, `npm run build:static` first runs `scripts/export-data.ts`. If the three source CSV files are missing (as they are in a clean CI checkout), export is skipped and the app can load from Supabase at runtime.

## Important boundaries

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public client configuration. Database access must be constrained by Supabase policies.
- Never expose a Supabase service-role key in frontend variables or commit it to the repository.
- Source CSVs contain personal student data and are ignored by Git; handle generated JSON with the same care if it contains identifying fields.
- Charts compare one score scale at a time. Raw and IRT scores use different units; see the Vietnamese product README for feature details.
