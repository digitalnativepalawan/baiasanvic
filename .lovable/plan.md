## What I'll do

1. Update the `ONYX_BASE_URL` secret to `https://cloud.onyx.app/api` (via the secure update form — I never see the value, you enter it).
2. Re-run the live reachability check by invoking `getOnyxStatus` against the preview. This calls `GET {ONYX_BASE_URL}/persona/{ONYX_RESORT_PERSONA_ID}` with your `ONYX_API_KEY` and reports `configured` / `reachable` / `error`.
3. Report the exact HTTP status back to you:
   - `200` → Onyx is live; redeploy so guests route through Onyx instead of the OpenRouter fallback.
   - `401/403` → base URL is correct but the API key isn't valid for `cloud.onyx.app` (keys are tenant-scoped; a key from a self-hosted/tunnel instance won't authenticate against Onyx's hosted cloud).
   - `404` again → `cloud.onyx.app` doesn't expose `/persona/{id}` at that path for your tenant; the correct base is something else (often a tenant subdomain like `https://<tenant>.onyx.app` or `https://cloud.onyx.app/tenant/<slug>/api`).
   - timeout/DNS → URL host is wrong.

## Why the original (`https://cloud.onyx.app`) returned 404

The health check hits `{BASE}/persona/1`. Against `https://cloud.onyx.app` that resolves to `https://cloud.onyx.app/persona/1`, which is a marketing/app route, not the REST API — so the server returns 404. Onyx's REST endpoints live under an `/api` prefix (and often under a tenant path). That's why we're trying `/api` next. If `/api` also 404s, the base URL isn't the hosted `cloud.onyx.app` at all — your working Onyx was almost certainly a self-hosted instance exposed via Cloudflare tunnel, and `cloud.onyx.app` is a different product tenant your API key won't authenticate to.

## About seeing your secrets

I'm not hiding them from you — the platform itself stores secret **values** write-only. Once saved, no tool (mine or the dashboard) can read the value back; that's a security property, not a permissions gate. What everyone (you and I) can see is:

- The **list of secret names** that exist (`ONYX_BASE_URL`, `ONYX_API_KEY`, etc.).
- Whether each is set.

What nobody can retrieve after save is the raw value. To change one, the secure form re-accepts a new value from you — I never receive it. If you want to *view* the current value of `ONYX_BASE_URL`, the honest answer is: you can't, and neither can I. You can only overwrite it. If you've lost track of it, the fix is to paste the correct value into the update form; the old one gets replaced.

If you want me to also print the *names* of every secret currently configured so you can confirm nothing is missing, say the word and I'll list them (names only, no values).

## Deliverable

After the test I'll tell you the exact status code and, if it's still not 200, which of the four causes above matches — so the next change is a one-shot fix, not another guess.