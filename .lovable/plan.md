# Admin-managed concierge knowledge base

Give the admin full CRUD over the concierge's knowledge, backed by Supabase, plus CSV template download and bulk upload. The current free-text "Extra knowledge" blob stays as-is for backwards compatibility, but new structured entries become the primary way to grow the bot's answers.

## 1. Database (Supabase migration)

New table `public.concierge_knowledge`:

- `id uuid pk`
- `topic text not null` — short slug like `breakfast`, `airport-van`, used for retrieval labeling
- `label text not null` — human title shown in admin
- `body text not null` — the actual knowledge (money is stripped at read time by existing `stripMonetary`)
- `tags text[] default '{}'` — optional keywords to boost retrieval matches
- `enabled boolean default true`
- `sort_order int default 0`
- `created_at`, `updated_at` timestamps + trigger

RLS: `SELECT` for `authenticated` + `anon` (bot needs to read via server fn using publishable client; simpler: read via service role on the server, so restrict to `service_role` only + `authenticated` for admin panel). Writes: `authenticated` only. GRANTs to `authenticated` + `service_role`.

## 2. Server functions (`src/baia/admin.functions.ts` additions)

All gated by existing `verifyAdminPasskey`:

- `listKnowledge()` — returns all rows ordered by `sort_order, label`
- `upsertKnowledge({ id?, topic, label, body, tags, enabled, sort_order })`
- `deleteKnowledge({ id })`
- `bulkImportKnowledge({ csv, mode: 'append' | 'replace' })` — parses CSV, validates, inserts (or wipes+inserts on `replace`)

CSV columns: `topic,label,body,tags,enabled,sort_order` (tags = `;`-separated). Template is generated on the client (no server round-trip needed) but export uses a server fn to dump current rows.

## 3. Retrieval integration (`src/baia/concierge.retrieve.ts`)

Load enabled rows once per request (cached briefly) and append each as its own `KnowledgeChunk` (id = `db:<uuid>`, label = row.label, text = `body` + tags appended for token matching). This is better than one big blob because each entry scores independently — matches your existing per-chunk retrieval + money-strip pipeline.

The existing free-text `customKnowledge` field continues to work unchanged.

## 4. Admin UI — new "Knowledge Base" tab in `AdminPanel.tsx`

New component `src/baia/components/KnowledgeManager.tsx`:

- Table of entries (label, topic, enabled toggle, edit, delete)
- "Add entry" button → modal with topic, label, body (textarea), tags (comma input), enabled, sort_order
- Toolbar buttons:
  - **Download all (CSV)** — current entries as backup
  - **Download blank template (CSV)** — headers + 2 example rows + inline instructions row
  - **Bulk upload CSV** — file picker + append/replace radio + preview count → confirm
- Uses same luxury styling tokens as existing admin tabs

## 5. Files touched

- New migration (create table + RLS + grants + trigger)
- `src/baia/admin.functions.ts` — 4 new server fns + CSV parsing
- `src/baia/concierge.retrieve.ts` — pull DB entries into chunk list
- `src/baia/components/KnowledgeManager.tsx` — new UI
- `src/baia/components/AdminPanel.tsx` — add nav item + route the tab
- `src/integrations/supabase/types.ts` regenerates after migration approval

## Notes

- Prices are still auto-stripped at retrieval time via existing `stripMonetary`, so admins can paste content freely without leaking rates.
- Bulk `replace` mode is destructive (wipes all rows then inserts) — UI will require a typed confirmation.
- No changes to Onyx standby, OpenRouter, or fallback logic.
