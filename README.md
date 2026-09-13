# GST Billing App

## Deploy to Vercel

1. Create a PostgreSQL database with a provider such as Neon, Supabase, or Vercel Postgres.
2. Import this repository into Vercel. The detected framework and build command are already configured by `package.json`.
3. Add these environment variables in Vercel for Production, Preview, and Development as needed:
   - `DATABASE_URL`: the PostgreSQL connection string, including `sslmode=require` when required by the provider.
   - `ADMIN_EMAIL`: email address that should receive the `ADMIN` role on signup.
   - `GOOGLE_CLIENT_ID`: Google OAuth web client ID used by the server.
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: the same client ID exposed to the browser.
4. Before the first production deploy, run the migration against the production database from a machine with the production `DATABASE_URL`:

   ```bash
   npm ci
   npx prisma migrate deploy
   ```

5. In Google Cloud Console, add the Vercel domain to the OAuth client’s authorized JavaScript origins. For previews, add each preview origin you intend to use.

The Vercel build runs `prisma generate && next build`. The application stores users, sessions, stock, and invoices in PostgreSQL; no local or serverless filesystem storage is used.

For local development, copy `.env.example` to `.env` and set `DATABASE_URL` to a PostgreSQL database before running `npm run db:deploy`.