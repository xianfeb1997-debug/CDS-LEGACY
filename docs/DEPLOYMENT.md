# Deployment Guide: GitHub -> Supabase -> Vercel

This guide assumes the repository root contains `package.json`, `app/`, `lib/`, and `database/supabase_schema.sql`.

## 1. Create the Supabase project

1. Sign in to Supabase and create a new project.
2. Save the database password somewhere secure.
3. Wait until the project database is ready.
4. Open **SQL Editor**.
5. Open `database/supabase_schema.sql` from this repository, copy the whole file, paste it into the SQL Editor, and run it.
6. Confirm that tables beginning with `ilaw_` appear in the Table Editor/database schema.

Do not create a public browser Supabase client for these Admin tables. The application uses a private server-side Postgres connection.

## 2. Get the serverless Supabase connection string

In the Supabase project dashboard:

1. Click **Connect**.
2. Select **Transaction pooler**.
3. Copy the Postgres URI, normally using port `6543`.
4. Replace the password placeholder with your real database password if needed.
5. Save the complete URI as `SUPABASE_DATABASE_URL`.

Example shape only:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

The app uses `postgres.js` with prepared statements disabled, which is appropriate for Supabase transaction pooling in serverless environments.

## 3. Prepare secrets

At minimum prepare:

```env
SUPABASE_DATABASE_URL=...
ILAW_ADMIN_KEY=...
NEXT_PUBLIC_APP_URL=https://YOUR-VERCEL-DOMAIN
AUTH_OTP_SECRET=...
```

Use long random values for `ILAW_ADMIN_KEY` and `AUTH_OTP_SECRET`.

Optional generation fallbacks:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=

GAMMA_API_KEY=
GAMMA_API_BASE_URL=https://public-api.gamma.app/v1.0
GAMMA_INITIAL_CREDITS=
```

You may instead add text/Gamma API keys later through `/admin` after Supabase is working.

For email signup, also configure SMTP. For Google login, configure Google OAuth. See `docs/AUTH_SETUP.md`.

## 4. Upload to a new GitHub repository

### GitHub website method

1. Create a new empty GitHub repository.
2. Do **not** add another README, `.gitignore`, or license during creation if you want the cleanest first push.
3. On your computer, extract this prepared project.
4. Make sure `.env.local` is not inside the files you plan to commit.
5. Run the commands below from the project root.

### Command-line push

```bash
git init
git add .
git commit -m "Prepare Vercel deployment with Supabase"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If the repository already has Git history, skip `git init` and connect/push the existing repository as appropriate.

## 5. Import the GitHub repository into Vercel

1. Sign in to Vercel.
2. Choose **Add New -> Project**.
3. Import the GitHub repository.
4. Vercel should detect **Next.js** automatically.
5. If `package.json` is at the repository root, leave **Root Directory** at the root.
6. Keep the standard Next.js build settings unless you have a reason to customize them.
7. Before production use, add the environment variables below in **Project Settings -> Environment Variables**.

Recommended required variables:

```text
SUPABASE_DATABASE_URL
ILAW_ADMIN_KEY
NEXT_PUBLIC_APP_URL
AUTH_OTP_SECRET
```

Add generation, SMTP, and Google OAuth variables as needed. Use the same variables for Production and Preview only when you intentionally want previews to use the production database/services. For safer testing, use separate preview credentials/projects.

## 6. Handle NEXT_PUBLIC_APP_URL on the first deploy

If you already know the Vercel project name, set:

```text
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
```

If Vercel assigns a different production URL, update `NEXT_PUBLIC_APP_URL` after the first deployment and redeploy.

If Google OAuth is enabled, also set:

```text
GOOGLE_REDIRECT_URI=https://YOUR-PRODUCTION-DOMAIN/api/auth/google/callback
```

and add that exact redirect URI in the Google Cloud OAuth client.

## 7. Deploy and verify

After deployment:

1. Open the public app URL.
2. Open `/admin` directly, for example `https://YOUR-DOMAIN/admin`.
3. Sign in with the value of `ILAW_ADMIN_KEY`.
4. Confirm the Admin dashboard loads without a database configuration error.
5. Add at least one user or configure signup.
6. Add text-model and Gamma keys in Admin, or confirm their fallback environment variables are set.
7. Test login, one Lesson/LAS generation, and one PPT generation.
8. If using email signup, test receipt and verification of an OTP email.
9. If using Google login, test the full OAuth redirect flow on the production domain.

## 8. Custom domain

Add your domain in **Vercel -> Project -> Settings -> Domains**. After the domain is active:

1. Change `NEXT_PUBLIC_APP_URL` to the custom HTTPS domain.
2. Change `GOOGLE_REDIRECT_URI` to the custom-domain callback if Google OAuth is enabled.
3. Update the authorized redirect URI in Google Cloud.
4. Redeploy so environment changes are applied.

## 9. Common deployment errors

### `Supabase database is not configured`

`SUPABASE_DATABASE_URL` is missing from Vercel or `.env.local`.

### `Supabase schema is missing`

Run `database/supabase_schema.sql` in the Supabase SQL Editor.

### `password authentication failed` / pooler connection failure

Re-copy the Transaction pooler URI and verify the database password. If the password contains special URL characters, use the connection string supplied by Supabase or URL-encode the password correctly.

### Admin opens but generation fails

Add valid OpenAI-compatible and/or Gamma API keys in `/admin`, or configure `OPENAI_API_KEY` / `GAMMA_API_KEY` in Vercel.

### Email OTP does not send

Check SMTP variables. For Gmail, use an App Password rather than the normal account password.

### Google sign-in returns a redirect mismatch

The URI in Google Cloud must exactly match the deployed callback URL, including `https://` and `/api/auth/google/callback`.

## 10. Security checklist

- Keep `SUPABASE_DATABASE_URL`, `ILAW_ADMIN_KEY`, `AUTH_OTP_SECRET`, SMTP passwords, OAuth secrets, and API keys server-side only.
- Never prefix secret variables with `NEXT_PUBLIC_`.
- Do not commit `.env.local`.
- Use a strong Supabase database password.
- Use separate Preview/Production Supabase projects or credentials when previews should not touch production data.
- Back up Admin data periodically using the Admin CSV export and Supabase database backup options appropriate to your plan.
