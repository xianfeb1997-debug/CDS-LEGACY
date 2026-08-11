# Database

The active database is **Supabase Postgres**.

Run this file once in **Supabase Dashboard -> SQL Editor**:

```text
database/supabase_schema.sql
```

The application connects from server-side Next.js code using `SUPABASE_DATABASE_URL`. For Vercel/serverless deployments, use the Supabase **Transaction pooler** connection URI.

Do not expose the database URI in browser code and do not commit it to Git.
