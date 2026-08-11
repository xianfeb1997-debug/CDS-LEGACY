# Admin Panel Setup

The Admin Panel is available at `/admin` and is intentionally not linked from the public UI.

## Required settings

Set these server-side variables:

```env
ILAW_ADMIN_KEY=long_random_admin_secret
SUPABASE_DATABASE_URL=your_supabase_transaction_pooler_uri
```

Run `database/supabase_schema.sql` in Supabase before opening the Admin Panel for the first time.

## Admin features

- Create, edit, activate, and deactivate users.
- Configure Lesson/LAS and PPT credit limits.
- Add rotating OpenAI-compatible text API keys.
- Add rotating Gamma API keys.
- Configure LAS header defaults.
- Manage signup and maintenance settings.
- Export/import Admin data as CSV or JSON backup.

## First production setup

1. Deploy with `ILAW_ADMIN_KEY` and `SUPABASE_DATABASE_URL` configured.
2. Browse directly to `https://YOUR-DOMAIN/admin`.
3. Enter the Admin key.
4. Create the first user, or enable signup and configure email/Google authentication.
5. Add generation API keys if you are not using environment-variable fallbacks.
