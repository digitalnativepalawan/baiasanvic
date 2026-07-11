## Goal

Make the two "TRUE LUXURY..." (Philosophy) and "PALAWAN AS IT SHOULD BE" (Island Intro) sections fully editable from the Admin panel, and add optional video support (device upload or YouTube URL) to every media slot on the site — hero first, plus philosophy, island intro, rooms, activities, and gallery.

## What's editable today vs. missing

Editable now (in `SiteContext` + Admin panel): hero title/subtitle/image, logo, header, footer, theme, gallery items, rooms, activities.

Hardcoded in `src/baia/App.tsx` (NOT editable — this is the bug in the screenshots):
- Philosophy section: eyebrow, headline, body copy, image, badge title/text.
- Island Intro block: eyebrow, headline, body copy, image, CTA label.

No section currently supports video (device MP4/WEBM or YouTube URL).

## Scope of changes

### 1. Two new editable sections

Add to `SiteContext`:
- `philosophy: { eyebrow, title, subtitle, image, videoUrl, youtubeUrl, badgeTitle, badgeText }`
- `islandIntro: { eyebrow, title, subtitle, ctaLabel, image, videoUrl, youtubeUrl }`

Wire `App.tsx` to render from context instead of hardcoded strings/images. Include the same `/api/site-assets/` URL normalization already used for hero/logo.

### 2. Video support (device + YouTube) on every media slot

Introduce a shared `MediaField` component in the admin panel that renders:
- Image upload (device) — accept `image/webp,image/png,image/jpeg,image/svg+xml` with a visible "Allowed: WEBP, PNG, JPG, SVG · Max 5 MB" label (matches existing hero behavior; extend to the other slots).
- Video upload (device) — accept `video/mp4,video/webm` with "Allowed: MP4, WEBM · Max 20 MB".
- YouTube URL input — validated `youtube.com/watch?v=…` or `youtu.be/…`.
- Clear/reset buttons per media type.

Backend: extend `admin.functions.ts` + `admin.server.ts` to accept video MIMEs and a higher size cap (20 MB) via the same server function, storing under `site-assets/uploads/…`. The existing `/api/site-assets/$` proxy already serves any object type — no route change needed.

Apply `MediaField` to:
- Hero (existing image → add video/YouTube).
- Philosophy (new).
- Island Intro (new).
- Rooms main image + slideshow entries.
- Activities image.
- Gallery items.

### 3. Front-end rendering priority

For any section with media, the render order is: `youtubeUrl` → embedded iframe; else `videoUrl` → `<video autoPlay muted loop playsInline>`; else `image` → `<img>`. Hero uses a full-bleed background video/iframe with the same overlay when a video is set.

### 4. File-type guidance in admin

Every upload input shows the accepted formats and max size directly under it (already partly done for hero/logo — replicate everywhere via `MediaField`).

### 5. Persistence

`saveSiteState` already stores the whole state blob keyed by `default`; new fields flow through automatically. No migration needed.

## Technical notes (for reviewers)

- Files touched: `src/baia/context/SiteContext.tsx`, `src/baia/App.tsx`, `src/baia/components/AdminPanel.tsx`, `src/baia/admin.server.ts`, `src/baia/admin.functions.ts`, `src/baia/components/RoomCard.tsx` (video branch in lightbox is already partly there), `src/baia/components/Activities.tsx`, `src/baia/components/IslandPerspectives.tsx`.
- YouTube URL parsed to `https://www.youtube.com/embed/<id>?autoplay=1&mute=1&loop=1&playlist=<id>&controls=0` for hero-style ambient loops; standard embed elsewhere.
- Server function keeps passkey verification; only MIME allowlist and size cap widen for video.
- No DB schema changes; `site_state.data` is JSONB.

## Out of scope

- Testimonials, footer, and navbar text (already editable; not mentioned as broken).
- Real auth (passkey stays as-is).

Approve to implement.