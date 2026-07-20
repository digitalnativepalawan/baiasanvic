The problem is not the browser cache. The project-level secrets no longer list `ONYX_BASE_URL` or `ONYX_API_KEY`, but the local `.env` file still contains `ONYX_BASE_URL`, `ONYX_API_KEY`, `ONYX_RESORT_PERSONA_ID`, and `ONYX_TIMEOUT_MS`. The admin status code checks `process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY`, so the app still thinks Onyx is configured and shows the stale tunnel warning.

Plan:
1. Remove only the stale Onyx connection variables from `.env`:
   - `ONYX_BASE_URL`
   - `ONYX_API_KEY`
   - `ONYX_RESORT_PERSONA_ID`
   - `ONYX_TIMEOUT_MS`
2. Leave these existing operation/webhook secrets untouched:
   - `ONYX_OPERATIONS_API_SECRET`
   - `ONYX_WEBHOOK_SECRET`
3. Restart/refresh the preview server environment so `getConciergeStatus()` returns `onyxConfigured: false`.
4. Verify the admin panel no longer shows the amber stale tunnel warning and instead shows the neutral “Onyx not connected” fallback message while OpenRouter remains active.