# Local Setup

## Requirements

- Node.js 20+ recommended.
- A Supabase project with `database/supabase_schema.sql` already applied.

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set at least:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
ILAW_ADMIN_KEY=your_local_admin_secret
SUPABASE_DATABASE_URL=your_supabase_connection_string
```

Use the Supabase **Transaction pooler** URI when you want local behavior to closely match Vercel.

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000` and `http://localhost:3000/admin`.

On Windows, `start-local.bat` copies `.env.local.example` to `.env.local` if needed, installs packages if necessary, and starts the dev server. It does not create the database schema; run `database/supabase_schema.sql` in Supabase first.
