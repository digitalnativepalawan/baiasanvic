/**
 * Integration RLS test for booking_inquiries public insert path.
 * Uses the ANON/publishable client ONLY (never service-role).
 * Run AFTER the A+B+C migration is applied in Lovable.dev.
 *
 * Run (from project root), loads .env without printing secrets:
 *   node --experimental-strip-types --import ./scripts/load-env.ts --test src/baia/__tests__/booking-inquiries.rls.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set (from .env). Not printed.");
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const MARK = `rls-test-${Date.now()}`;

test("complete website row (channel=website, status=pending) succeeds via anon", async () => {
  const { error } = await anon.from("booking_inquiries").insert({
    resort_id: "baia-san-vicente",
    idempotency_key: MARK,
    channel: "website",
    status: "pending",
    check_in: "2026-09-01",
    check_out: "2026-09-03",
    guest_name: "RLS Tester",
    guest_email: "rls@test.com",
    guests_count: 2,
    total_nights: 2,
    total_price: 0,
    notes: "RLS_TEST_MARKER",
  });
  assert.equal(error, null, `complete website insert should succeed: ${error?.message ?? ""}`);
});

test("partial website row fails via anon", async () => {
  const { error } = await anon.from("booking_inquiries").insert({
    resort_id: "baia-san-vicente",
    idempotency_key: `${MARK}-partial`,
    channel: "website",
    status: "pending",
    check_out: "2026-09-03",
    notes: "RLS_TEST_MARKER",
  });
  assert.ok(error, "partial website row must be rejected by policy/CHECK");
});

test("anon row with channel=onyx_agent fails", async () => {
  const { error } = await anon.from("booking_inquiries").insert({
    resort_id: "baia-san-vicente",
    idempotency_key: `${MARK}-onyx`,
    channel: "onyx_agent",
    status: "pending",
    notes: "RLS_TEST_MARKER",
  });
  assert.ok(error, "anon channel=onyx_agent must be rejected by INSERT policy");
});
