# Deployment

## Cloudflare Pages

The configured Pages project is `ketquathithumitht`; `wrangler.jsonc` sets `dist` as the build output directory. The deployment command is:

```sh
npm run deploy
```

This runs `npm run build:static` and then `wrangler pages deploy dist --project-name ketquathithumitht --branch main`. The app's public URL and repository are listed in `docs/README.md` and the root README.

Provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the build environment when the deployed app should read from Supabase. These are client-visible values; use database policies to control access. Do not set a service-role key as a `VITE_*` variable. If the source CSVs are present during build, the static export writes JSON into `public/data/`; otherwise the build skips export and runtime data must be available from Supabase.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and manual dispatch. It uses Node.js 22, runs `npm ci`, `npm run lint`, and `npm run build:static`. The workflow expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as GitHub Actions secrets if Supabase-backed builds are required. CI does not deploy; production deployment is the separate `npm run deploy` command.

## Node/Express deployment

For a Node host, run `npm run build` and then `npm run start`. The server serves the Vite output from `dist` in production and loads the root CSV inputs into memory for its API. Set `PORT` as required by the host and ensure the CSV files exist in the working directory if the API should serve local dataset content. This server is not configured as a Cloudflare Pages Function.

## Release checklist

1. Confirm the target Supabase schema and row-level security policies are current.
2. Check build-time Supabase variables in the chosen deployment environment.
3. Run `npm run lint` and `npm run build:static` locally or rely on the CI workflow.
4. Confirm the intended dataset is available through Supabase or the generated static JSON.
5. Deploy with `npm run deploy` and verify student lookup and cohort analytics against the intended dataset.
