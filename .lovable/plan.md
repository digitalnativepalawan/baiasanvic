# Investors Section

Add a new "Investors" section to the BAIA one-page site, laid out like the reference image, using the site's existing dark luxury design system (serif display headings, tracked-out eyebrow labels, gold hairlines, glass panels). All copy in English. All figures shown in PHP with USD reference.

## Where it goes

- New component `src/baia/components/Investors.tsx`, rendered in `src/baia/App.tsx` as `<section id="investors">`, placed after the Stay/rooms area and before Activities.
- Nav: an "Investors" link is added so it appears in the header even for the existing saved site config (merged in if not already present), scrolling to `#investors`.

## Layout (matching the reference image)

1. **Header band** — eyebrow "INVESTORS", serif headline "From proven places to visionary expansion.", short paragraph on AMUMA building barefoot boutique resorts, and a "Request Investor Deck" button.
2. **What we're building** — "AMUMA San Vicente" with four icon stats: 4 Suites, 2 Villas, San Vicente Palawan, Balabac (in development), plus the short line about land secured in San Vicente and Balabac with BAIA and Marina Terrace as operator partners.
3. **Unit typologies** — two cards (Gemini Suite / Villa), each with image + floor-plan slot, footprint, interior sqm, guests, and indicative EXW cost in PHP with USD in smaller text.
4. **Capital snapshot** — Gemini Suite ₱1,043,000 (~$17,850) each, Villa ₱728,000 (~$12,460) each, shipping quoted separately, footnote "All costs are EXW Guangzhou, China."
5. **Project timeline** — 2026 planning & Circle launch, 2027 site development & construction, 2028 AMUMA San Vicente opening, 2029 Balabac groundbreaking, with connector line and bullet sub-points.
6. **Circle model** — 60% to Circle Members / 40% to AMUMA, as two overlapping circles, with four benefit icons: Shared Growth, Lifestyle Access, Aligned Values, Long-term Value.
7. **Closing band** — "Be part of something rare and enduring." + supporting line + "Request Investor Deck" button + "Limited Circle memberships available."

The reference image is light-toned; the section will use the site's own palette so it reads as part of BAIA rather than a pasted-in page.

## Behaviour

- "Request Investor Deck" opens the existing booking/inquiry modal in an investor-inquiry mode (name, email, message) so submissions land in the same inquiries table as booking inquiries, tagged as an investor request.
- Fully responsive: stacked on mobile, no horizontal scrolling.

## Content and currency

- Figures used: Gemini Suite 6.5 x 11m, 62 sqm, 2 guests, $17,850; Villa 3.3 x 8.5m, ~24.5 sqm, 2 guests, $12,460. PHP shown as primary with a fixed conversion note ("indicative, at ₱58.40 / USD" — exact rate confirmed before build).
- No Chinese text anywhere; unit names shown as "Gemini Suite" and "Villa".

## Technical notes

- Static content in the component for now (no schema change, no admin fields) — matching the current section-by-section pattern; admin editability can follow in a later pass if wanted.
- Uses existing tokens (`gold-*`, `luxury-*`, `.eyebrow`, `.display-heading`, `.glass-panel`) and `lucide-react` icons; no new dependencies.
- Images: placeholder slots wired to easily swappable URLs so real renderings can be dropped in later.
