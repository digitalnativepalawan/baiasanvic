# Neon & Vercel Migration Guide for BAIA

## 1. Overview
The project has been detached from hardcoded `lovable.app` references and configured with:
- **Neon Postgres Client Support** via `@neondatabase/serverless` (see `src/integrations/neon/client.server.ts`).
- **Neon Configuration file** (`neon.ts`) using `@neon/config/v1`.
- **Environment variable handling** compatible with Vercel and any standalone host.
- **Vercel deployment configuration** (`vercel.json`).

---

## 2. Neon Database Connection
Your Neon Postgres connection string is configured in `.env.example`:
```env
DATABASE_URL="postgresql://neondb_owner:npg_smui0WFqZ6Oh@ep-patient-dew-azmm384u-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### Initializing Neon Schema
To create all tables, policies, and seed data in your Neon database, run the SQL files in `supabase/manual_sql/` in order using Neon's SQL Editor (or `psql` / Neon Console):
1. `supabase/manual_sql/000_preflight_existing_schema.sql`
2. `supabase/manual_sql/001_resorts_and_operations.sql`
3. `supabase/manual_sql/002_agent_runtime.sql`
4. `supabase/manual_sql/003_booking_leads_idempotency.sql`
5. `supabase/manual_sql/004_tala_agent.sql`

---

## 3. Neon CLI Local Setup Commands
Run these in your local terminal where external network & browser login are available:

```bash
# 1. Install & authenticate Neon CLI
npm i -g neon@latest && neon login

# 2. Add skills and MCP
neon skills -y
neon mcp -y

# 3. Link project
neon link --project-id hidden-morning-12845519 --branch production -y

# 4. Neon config init
neon config init

# 5. Neon deploy & install skills
neon deploy
npx neon@latest skills -s neon -s neon-postgres -y
```

---

## 4. Deploying to Vercel
1. Import this Git repository into your Vercel team/account.
2. In the Vercel Project Settings -> **Environment Variables**, add:
   - `DATABASE_URL`: Your Neon Postgres connection string.
   - `SITE_URL`: Your production Vercel domain (e.g., `https://your-app.vercel.app`).
   - `SUPABASE_URL` & `SUPABASE_PUBLISHABLE_KEY` (if utilizing Supabase Auth / Storage).
   - `OPENROUTER_API_KEY`: (Optional) for AI Concierge & TALA agent capabilities.
3. Deploy!
