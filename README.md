# Classroom Design Suite

A Next.js classroom-materials workspace for generating ILAW-aligned lesson plans, Learning Activity Sheets (LAS), and Gamma-based presentation slides.

This deployment-ready edition uses **Supabase Postgres** for users, authentication metadata, admin settings, credits, API-key rotation, OTP records, and backup/restore data. It is prepared for **GitHub -> Vercel** deployment.

## Main features

- Lesson plan, LAS, and PPT generation.
- Email/password signup with OTP verification.
- Optional Google OAuth sign-in.
- Hidden `/admin` panel protected by `ILAW_ADMIN_KEY`.
- Per-user Lesson/LAS and PPT credit limits.
- Rotating OpenAI-compatible text API keys and Gamma API keys.
- CSV admin backup/restore.
- Maintenance mode and signup controls.
- Supabase Postgres persistence suitable for Vercel serverless deployments.

## Required deployment setup

1. Create a Supabase project.
2. In **Supabase -> SQL Editor**, run `database/supabase_schema.sql` once.
3. In **Supabase -> Connect**, copy the **Transaction pooler** connection string and set it as `SUPABASE_DATABASE_URL`.
4. Set a strong `ILAW_ADMIN_KEY`.
5. Push this repository to GitHub.
6. Import the GitHub repository into Vercel and add the environment variables.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the complete GitHub, Supabase, and Vercel walkthrough.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows you can also run `start-local.bat` after configuring `.env.local`.

Local URLs:

```text
App:   http://localhost:3000
Admin: http://localhost:3000/admin
```

## Important environment variables

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
ILAW_ADMIN_KEY=replace_with_a_long_random_secret
SUPABASE_DATABASE_URL=postgresql://postgres.PROJECT_REF:[PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres
```

Generation services can be configured either in `/admin` or as server-side fallback variables:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=

GAMMA_API_KEY=
GAMMA_API_BASE_URL=https://public-api.gamma.app/v1.0
```

For email OTP signup, configure SMTP and set a strong `AUTH_OTP_SECRET`. For Google login, configure the Google OAuth variables. See `.env.example` and `docs/AUTH_SETUP.md`.

## Supabase behavior

The app connects to Supabase Postgres only from server-side Next.js code. `SUPABASE_DATABASE_URL` must **never** be exposed with a `NEXT_PUBLIC_` prefix or committed to GitHub.

The database schema is intentionally applied from `database/supabase_schema.sql` rather than being created automatically during a Vercel request. If the schema is missing, the Admin API returns a setup message telling you to run the SQL file.

## Build checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Before pushing to GitHub

Do not commit `.env.local`, `.env`, `.vercel`, generated backups, API keys, SMTP passwords, database passwords, or OAuth client secrets. The included `.gitignore` already excludes local secret files and build output.

## Old SQLite data

This edition no longer uses SQLite. If you have an older deployed copy with important Admin data, export an Admin CSV backup from the old version first, then import that CSV from the new Supabase-backed `/admin` panel.

## License

Private project. Add your preferred license before making the repository public.
