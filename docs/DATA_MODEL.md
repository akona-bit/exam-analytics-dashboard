# Data model

## Client types

The principal frontend shapes are defined in `src/types.ts`:

- `StudentData`: student identifier and display fields, optional email/SBD/gender/exam code, score objects for `tho` and `irt`, optional note/display name, and optional per-question responses.
- `QuestionData`: question id and subject, attempt/correct/incorrect counts, IRT difficulty (b) and discrimination (a) parameters, and optional error marker.
- `MetricKey`: `tho` or `irt`; `SubjectKey`: `tv`, `ta`, `toan`, or `tdkh`.

The API and static export map the CSV parser's snake_case fields to the frontend's camelCase representation. Keep these mappings aligned in `server/server.ts` and `scripts/export-data.ts`.

## CSV inputs

Three root-level CSV files are used:

| File | Parsed into | Role |
|---|---|---|
| `raw_students.csv` | `ParsedStudent` | Student identity and subject scores. |
| `raw_student_responses.csv` | `ParsedResponse` | Per-student answer status by question. |
| `questions.csv` | `ParsedQuestion` | Per-question aggregates and IRT parameters (difficulty `b`, discrimination `a`). |

The exact accepted headers and normalization rules are implemented in `src/lib/csvParser.ts`. Responses use statuses `correct`, `wrong`, and `missing`; a student response list is ordered by original question number. Source CSVs are ignored by Git because they contain student data.

## Supabase

SQL definitions and migrations are in `db/`. Apply the base schema and relevant migrations in order for the target project; consult each SQL file before applying it because migration state can differ between environments. `scripts/import-supabase.ts` writes parsed students, responses, questions, and exam-specific records. The importer supports exam types `survey` and `mock` and normally replaces data for the selected type.

The frontend uses the Supabase anon key. Restrict read/write access using the policies in the SQL schema and keep privileged credentials server-side. Do not assume that a table is safe to expose merely because the key is called `anon`.

## Generated JSON and API

`npm run export-data` creates:

- `public/data/students.json`: sorted student records with scores and a response-status array.
- `public/data/questions.json`: question metadata and aggregate statistics.

The Express API exposes equivalent normalized data at `GET /api/students` and `GET /api/questions`. These are used for local/server operation; static deployments can fetch the generated JSON files or use Supabase.

## Personal data handling

Student names, candidate numbers, email addresses, scores, and answer histories are personal data. Keep raw and generated datasets out of source control and only publish them to an access-controlled data store intended for this audience. Review Supabase row-level security and storage/public access settings whenever the schema or data-loading path changes.
