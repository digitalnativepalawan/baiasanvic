## Fix stale Onyx tunnel warning

**Problem:** Admin → AI Concierge shows a yellow warning: "Onyx is configured but not reachable right now — likely a stale tunnel URL." Guests are already being served correctly by the OpenRouter fallback, but the warning appears because `ONYX_BASE_URL` still points at the dead Cloudflare tunnel (`mathematical-listening-sort-bargains.trycloudflare.com`).

**Root cause:** The `ONYX_BASE_URL` project secret is still set. As long as both `ONYX_BASE_URL` and `ONYX_API_KEY` exist, the concierge status probe tries Onyx first, fails, and surfaces the yellow banner — even though the fallback works.

**Fix (secrets only, no code changes):**
1. Delete the `ONYX_BASE_URL` project secret so the concierge stops attempting the stale tunnel.
2. Leave `ONYX_API_KEY` in place (unchanged) so Onyx can be re-enabled later just by setting a fresh `ONYX_BASE_URL`.
3. No application code, admin UI, Supabase schema, or concierge logic changes.

**Expected result after redeploy:**
- Yellow "Onyx not reachable" warning disappears.
- Green "Concierge active through OpenRouter" remains.
- Guest chat continues to work via the existing OpenRouter fallback with all guardrails intact (no prices, menu confirmation, lead capture, etc.).

**If you later get a fresh Onyx URL:** just set `ONYX_BASE_URL` to the new value; no code change needed and the primary Onyx path re-activates automatically.