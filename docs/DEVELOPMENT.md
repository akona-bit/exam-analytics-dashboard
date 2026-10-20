# Development

## Requirements and setup

- Node.js 22 (used by CI)
- npm and the committed `package-lock.json`

```sh
npm ci
cp .env.example .env
npm run dev
```

The local Express server listens on port 3000 by default and mounts Vite middleware outside production. Set `PORT` to change the port. Configure the two `VITE_SUPABASE_*` values in `.env` to use Supabase. Without them, the app can use the local `/api` or exported static JSON, depending on the running mode and available data.

## npm scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run the Express server and Vite development middleware (requires Bun for this script). |
| `npm run build` | Build the Vite app and bundle the Express server. |
| `npm run build:static` | Export CSV data when present, then build the static site for Pages. |
| `npm run export-data` | Parse root CSV files and write `public/data/students.json` and `questions.json`. |
| `npm run import:supabase -- --type=survey` | Import source CSV records into Supabase. Supports `mock` exam type too. |
| `npm run lint` | Run TypeScript type checking (`tsc --noEmit`). |
| `npm run preview` | Preview the built Vite site locally. |
| `npm run start` | Run the bundled Express server after `npm run build`. |
| `npm run deploy` | Export data, build, and deploy `dist` to the configured Cloudflare Pages project. |

Note: the `dev` script invokes `bun`, although the lockfile and CI use npm. Install Bun to use that command, or use the repository's documented Node/npm workflows as appropriate.

## Data workflow

The local server and scripts expect `raw_students.csv`, `raw_student_responses.csv`, and `questions.csv` in the project root. The CSV parser in `src/lib/csvParser.ts` is shared by server, export, and import paths; update it when changing source formats. `npm run export-data` writes generated files into `public/data/`. These contain student-level data and should be treated as sensitive. The raw CSVs are intentionally excluded from Git.

Before importing into a live Supabase project, run a dry run:

```sh
npm run import:supabase -- --type=survey --dry-run
```

The importer deletes existing rows for that exam type by default before writing replacement records. Use `--no-delete` to retain existing rows. `--prune-unknown` filters payload columns against the live PostgREST schema when migrations are not aligned. Supply credentials through environment variables; never commit service-role credentials.

## Code map and conventions

- Keep shared data shapes in `src/types.ts` and parsing in `src/lib/csvParser.ts`.
- Keep reusable score calculations in `src/lib/analytics.ts` rather than embedding them in charts.
- UI labels and comments are mostly Vietnamese; the technical docs are English.
- `src/lib/knowledgeStructure.ts` and `src/lib/examCodesMapping.ts` contain domain mappings; verify these against the current exam specification when changing exam data.
