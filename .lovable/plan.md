## Goal

Give the admin control over how each video plays (sound, loop, autoplay, controls, poster) and make videos load fast on first paint after publish.

## Problems today

1. Every `<video>` in the site is hardcoded `autoPlay muted loop playsInline` with no `controls` — users can't unmute, pause, or scrub.
2. YouTube embeds are forced to `autoplay=1&mute=1&loop=1&controls=0` — same issue.
3. Uploaded videos are served through `/api/site-assets/$` which streams the whole object from storage on every request (no `Range` support, no CDN cache hit on first visit). On a fresh publish this means multi-MB videos block the hero paint.
4. No `poster` image, no `preload` strategy, no lazy loading for below-the-fold videos — hero video downloads eagerly even when a poster would do.

## Changes

### 1. Per-video playback settings (admin-editable)

Extend the media shape everywhere a video slot exists (hero, philosophy, island intro, rooms, activities, gallery) with:

- `autoplay` (default true for hero background, false elsewhere)
- `muted` (default true — required for autoplay to work in browsers)
- `loop` (default true for ambient hero, false elsewhere)
- `controls` (default true everywhere except full-bleed hero background)
- `posterUrl` (image shown before play; uploaded like any other image)

Admin panel: under every `MediaField` that accepts video, add a small "Playback" group with 4 toggles + a poster image uploader. Include a helper note: "Browsers block autoplay unless the video is muted. Turn autoplay off if you want the visitor to press play and hear sound."

### 2. Rendering

Central `MediaFrame` reads those flags:

- `<video>` element: `autoPlay={autoplay && muted}` (never autoplay with sound), `muted={muted}`, `loop={loop}`, `controls={controls}`, `playsInline`, `poster={posterUrl}`, `preload={autoplay ? "auto" : "metadata"}`.
- YouTube iframe: build the embed URL from the same flags (`autoplay`, `mute`, `loop`+`playlist=<id>`, `controls`). If autoplay is off, don't force mute.
- Below-the-fold videos get `preload="none"` + `loading="lazy"` on the poster image; the `<video>` only mounts after the section scrolls into view (IntersectionObserver).

### 3. Faster loading of uploaded videos

- Add `Range` request support and correct `Accept-Ranges`, `Content-Length`, `Content-Range`, `206 Partial Content` handling to `src/routes/api/site-assets/$.ts` so browsers can start playback before the full file downloads and can seek.
- Keep the existing `cache-control: public, max-age=31536000, immutable` — the CDN in front of the published site will cache after the first hit.
- Hero: require a `posterUrl` for videos (admin panel warns if missing); the poster is what the visitor sees during the first byte of video download, so LCP is the poster image, not the video.
- Admin UI copy: recommend keeping hero videos under ~5 MB, 1080p max, H.264 MP4 or WebM, and always uploading a poster. Add a line explaining that very large videos will feel slow on mobile.

### 4. Defaults on existing content

Migrate current state on load: if a section has `videoUrl` or `youtubeUrl` but no playback flags, default to `{ autoplay: true, muted: true, loop: true, controls: false }` for hero and `{ autoplay: false, muted: false, loop: false, controls: true }` for every other section — so non-hero videos immediately gain a working play button with sound.

## Files touched

- `src/baia/context/SiteContext.tsx` — extend media types with playback flags + poster, add migration defaults.
- `src/baia/App.tsx` — `MediaFrame` reads flags, builds YouTube URL from flags, adds IntersectionObserver-based lazy mount.
- `src/baia/components/AdminPanel.tsx` — Playback toggles + poster uploader on every video-capable slot; helper copy about muted autoplay and file size.
- `src/baia/components/RoomCard.tsx`, `Activities.tsx`, `IslandPerspectives.tsx` — render via `MediaFrame` (or mirror the same flag logic) so room/activity/gallery videos also honor admin settings.
- `src/routes/api/site-assets/$.ts` — implement HTTP `Range` handling for partial content responses.

## Out of scope

- Transcoding uploads to multiple bitrates or generating posters server-side (would need ffmpeg — not available in the Worker runtime). Admin uploads the poster manually.
- Switching storage/CDN providers.
