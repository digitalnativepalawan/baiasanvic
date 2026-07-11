## Problem

The admin panel unlocks with a client-side passkey (`5309`) that creates no Supabase session. As a result:
- Image uploads to the private `site-assets` bucket are blocked by RLS (`storage.objects` requires an authenticated admin).
- `site_state` upserts are gated by `isAdminRef` (a real Supabase admin session), so hero/logo/rooms/theme edits never save.
- No file-type restriction on `<input type="file">`, so users can pick anything.

## Fix

Route admin writes through TanStack server functions that use the service-role client and validate the passkey server-side. Keep the passkey UX unchanged.

### 1. Add server passkey secret
- Add `ADMIN_PASSKEY` secret (value `5309`) so it isn't hard-coded in the client for writes. The client keeps its passkey for unlocking UI; the server independently verifies for mutations.

### 2. New server functions (`src/baia/admin.functions.ts`)
- `uploadSiteAsset({ passkey, filename, contentType, base64 })` — verifies passkey, validates MIME is `image/*` (png/jpeg/webp/gif/svg), size ≤ 5 MB, uploads to `site-assets` via `supabaseAdmin`, returns a signed URL (long-lived) or switches the bucket to public and returns `getPublicUrl`. Preferred: flip bucket to public (via `supabase--storage_update_bucket`) so `<img src>` works everywhere without re-signing.
- `saveSiteState({ passkey, data })` — verifies passkey, upserts the single `site_state` row via `supabaseAdmin`.

### 3. Client wiring
- `AdminPanel.handleImageUpload`: read file → base64 → call `uploadSiteAsset` server fn → pass returned `url` to existing callback. Add `accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"` on all file inputs (hero, logo, gallery, rooms main image, room slideshow, activity image) and a size check (≤5 MB) with a friendly error.
- `SiteContext`: store the passkey in a ref when `AdminGate` unlocks (via a small `setAdminPasskey` on context). Replace the direct `supabase.from("site_state").upsert(...)` in the debounced save with a call to `saveSiteState` server fn. Drop the `isAdminRef` Supabase-auth check; gate saving on "passkey present in memory".
- `AdminGate`: on successful passkey, call `setAdminPasskey("5309")` from context; on Lock, clear it.

### 4. Bucket visibility
- Flip `site-assets` bucket to public so uploaded image URLs render on the public site. Keep write policies restrictive (writes only go through service-role server fn).

### 5. Verify
- Build + typecheck.
- Manual: unlock admin, upload a logo PNG and a hero JPG from device, refresh page, confirm both persist and render.

## Notes / trade-offs

- Passkey in a client bundle is not real security — same posture as today. Server-side verification just prevents a random visitor from hitting the server fn without the passkey. If you later want real auth, we switch `AdminGate` back to Supabase email/password and drop the passkey check.
- Files stored under `site-assets/uploads/<timestamp>-<rand>.<ext>`; publicly readable once bucket is public.
