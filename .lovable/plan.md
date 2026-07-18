# Cinematic Hero & Philosophy Redesign

## Goal
Replace the current split-layout Philosophy section (which feels like a "desecration") with a full-bleed cinematic video/image moment, and move the existing palm-tree video to the hero so the site opens with a cinematic scene.

## What we will change

### 1. Hero — full-screen cinematic video
- Keep the existing `h-screen` hero structure.
- Ensure the hero background video already in `philosophy.videoUrl` / `philosophy.youtubeUrl` is migrated to `hero` so it becomes the opening cinematic shot.
- Dark gradient overlay stays; hero title/subtitle remain overlaid and readable.
- The hero admin video controls (already in AdminPanel) are left unchanged.

### 2. Philosophy — full-bleed cinematic section
- Remove the `max-w-7xl` two-column grid and the floating "THE EXPERIENCE" badge.
- Redesign as a full-width, full-height (min-h-screen or min-h-[80vh]) section with `MediaFrame` filling the entire background.
- Center the quote text (`eyebrow`, `title`, `subtitle`) over the media with a dark gradient overlay.
- If no video is set, the section image becomes the full-bleed background.
- Maintain existing `MediaFrame` playback controls (autoplay, mute, loop, controls, poster).

### 3. Data migration
- In `SiteContext` state normalization, add a one-time automatic migration: if `hero` has no video source but `philosophy` does, copy `videoUrl`/`youtubeUrl` to `hero` and clear them from `philosophy`.
- Existing users who already saved a philosophy video will see it move to the hero immediately on next load.

### 4. Admin panel updates
- Remove the `badgeTitle` and `badgeText` input fields from the Philosophy tab (the floating badge is gone).
- Keep eyebrow, headline, body copy, image/video upload, YouTube URL, and playback controls.
- Add a small helper button: "Move Philosophy video to Hero" when a philosophy video exists but hero has none.

### 5. Styling & motion
- Use existing `luxury`/`gold` design tokens only; no hardcoded colors.
- Add subtle scroll-triggered fade-up on the centered text.
- Keep typography clean, large, and cinematic (uppercase serif headline, small sans-serif body).

## Files to edit
- `src/baia/App.tsx` — hero + philosophy section layout
- `src/baia/context/SiteContext.tsx` — one-time video migration
- `src/baia/components/AdminPanel.tsx` — remove badge fields, add move-to-hero helper

## Verification
- Run `bun run build` (or `tsgo --noEmit`) to confirm no type errors.
- Check the preview: hero should show the palm-tree video, philosophy should be a full-bleed cinematic quote card with no floating badge.