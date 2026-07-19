/**
 * Unit tests for the BAIA operations handler (create_guest_lead).
 * Uses the TEST persistence adapter (Supabase UNCONFIRMED). Run with:
 *   node --experimental-strip-types --test src/baia/__tests__/ops.guest-lead.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleCreateGuestLead,
  validateGuestLead,
  verifyOnyxOpsSecret,
  OpsError,
  type GuestLeadInput,
} from "../ops/guest-lead.server.ts";

function baseInput(overrides: Partial<GuestLeadInput> = {}): GuestLeadInput {
  return {
    resort_id: "baia-san-vicente",
    idempotency_key: `k-${Math.random().toString(36).slice(2)}-abcdef`,
    channel: "website",
    guest: { name: "Unit Guest" },
    ...overrides,
  };
}

test("creates a lead and verifies it (test adapter)", async () => {
  const input = baseInput();
  const ev = await handleCreateGuestLead(input);
  assert.equal(ev.ok, true);
  assert.equal(ev.created, true);
  assert.equal(ev.verified, true);
  assert.equal(ev.persistence, "test-adapter");
  assert.ok(ev.lead_id.startsWith("lead_"));
  assert.equal(ev.verification.found, true);
});

test("idempotency: same key returns same lead, no duplicate", async () => {
  const input = baseInput({ idempotency_key: "fixed-idem-key-123456" });
  const first = await handleCreateGuestLead(input);
  const second = await handleCreateGuestLead({ ...input });
  assert.equal(first.lead_id, second.lead_id);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
});

test("rejects monetary fields anywhere (absolute pricing rule)", () => {
  assert.throws(
    () => validateGuestLead(baseInput({ stay: { price: 5000 } as never })),
    (e: unknown) => e instanceof OpsError && e.status === 422 && /Monetary/.test((e as OpsError).message),
  );
  assert.throws(
    () => validateGuestLead(baseInput({ notes: "ok" , guest: { name: "x", discount: 10 } as never })),
    (e: unknown) => e instanceof OpsError && e.status === 422,
  );
});

test("rejects unknown resort_id", () => {
  assert.throws(
    () => validateGuestLead(baseInput({ resort_id: "some-other-resort" })),
    (e: unknown) => e instanceof OpsError && e.status === 422,
  );
});

test("rejects missing idempotency key", () => {
  assert.throws(
    () => validateGuestLead(baseInput({ idempotency_key: "" })),
    (e: unknown) => e instanceof OpsError && e.status === 422,
  );
});

test("rejects a lead that confirms availability/booking", () => {
  assert.throws(
    () => validateGuestLead(baseInput({ notes: "Booking confirmed for August" })),
    (e: unknown) => e instanceof OpsError && e.status === 422,
  );
});

test("auth: missing header rejected", () => {
  process.env.ONYX_OPERATIONS_API_SECRET = "unit-secret-000";
  assert.throws(() => verifyOnyxOpsSecret(null), (e: unknown) => e instanceof OpsError && (e as OpsError).status === 401);
});

test("auth: wrong secret rejected, correct accepted", () => {
  process.env.ONYX_OPERATIONS_API_SECRET = "unit-secret-000";
  assert.throws(
    () => verifyOnyxOpsSecret("Bearer wrong"),
    (e: unknown) => e instanceof OpsError && (e as OpsError).status === 403,
  );
  assert.doesNotThrow(() => verifyOnyxOpsSecret("Bearer unit-secret-000"));
});

test("handleCreateGuestLead preserves internal email/adults mapping (test adapter)", async () => {
  const res = await handleCreateGuestLead({
    resort_id: "baia-san-vicente",
    idempotency_key: "unit-idem-" + Math.random().toString(36).slice(2),
    channel: "onyx_agent",
    guest: { name: "Unit Tester", email: "unit@test.com" },
    stay: { adults: 2, children: 1 },
  });
  assert.equal(res.ok, true);
  assert.equal(res.stored.email, "unit@test.com");
  assert.equal(res.stored.adults, 2);
  assert.equal(res.stored.guest_name, "Unit Tester");
  assert.equal(res.stored.children, 1);
});
