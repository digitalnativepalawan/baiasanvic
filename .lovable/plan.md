## Goal
Deploy commit `c1a45c6` to the live BAIA site and verify the deterministic concierge layer (28 knowledge chunks read directly from the TypeScript source) is serving guests. No Onyx checks.

## Steps

1. **Sync + build**
   - Confirm workspace is on `c1a45c6` (latest main).
   - Run `bun run build` and surface any errors verbatim if it fails.

2. **Security gate**
   - Run `security--get_scan_results`; if a fresh scan is missing, trigger one. Block publish only on unresolved criticals.

3. **Publish**
   - Call `preview_ui--publish` to redeploy to `baia.merqato.digital` / `baiasanvic.lovable.app`. No code, secret, or config changes.

4. **Verify deterministic layer live**
   - Hit the live concierge endpoint with 3 probe questions that must be answered by the deterministic chunks (no LLM fallback needed):
     - "What time is check-in?" → expects 14:00–21:00 (checkinCheckout chunk)
     - "How much is the airport van?" → expects ₱6,000 (airportTransfer chunk)
     - "Where is BAIA?" → expects Penanindigan / San Vicente, not Port Barton (about chunk)
   - Report the raw answers back so you can eyeball that the 28-chunk layer is serving them.

## Out of scope
- Onyx reachability, secrets, or fallback wiring.
- Any code, style, or content edits.
