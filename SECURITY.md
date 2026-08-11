# Security Notes

Never commit or expose:

- `.env.local` or production environment files.
- `SUPABASE_DATABASE_URL` or the Supabase database password.
- `ILAW_ADMIN_KEY` or `AUTH_OTP_SECRET`.
- OpenAI-compatible, Gamma, SMTP, or OAuth secrets.
- Admin CSV/JSON backups that contain user records or API keys.

Only `NEXT_PUBLIC_*` variables are intended for browser exposure. Do not rename server secrets with a `NEXT_PUBLIC_` prefix.

The Supabase Postgres connection is used only from server-side Next.js code. Use Vercel Environment Variables for deployed secrets and GitHub secrets only if you later add CI workflows that need them.
