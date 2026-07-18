import { createFileRoute } from "@tanstack/react-router";

/**
 * Onyx operations endpoint: create a guest lead in `public.booking_inquiries`.
 * Auth: `Authorization: Bearer <ONYX_OPERATIONS_API_SECRET>`.
 * Method: POST with a JSON object body. Server forces resort_id/channel/status
 * and never accepts caller-supplied price. Duplicate (resort_id,
 * idempotency_key) returns the existing row instead of erroring.
 */

const RESORT_ID = "baia-san-vicente";
const CHANNEL = "onyx_agent";
const STATUS = "pending";

type LeadBody = {
  guest_name?: unknown;
  guest_email?: unknown;
  phone?: unknown;
  check_in?: unknown;
  check_out?: unknown;
  guests_count?: unknown;
  children_count?: unknown;
  total_nights?: unknown;
  room_tier_id?: unknown;
  room_tier_name?: unknown;
  room_preference?: unknown;
  special_requests?: unknown;
  notes?: unknown;
  transport_needed?: unknown;
  idempotency_key?: unknown;
};

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const Route = createFileRoute("/api/ops/guest-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ONYX_OPERATIONS_API_SECRET;
        if (!expected) {
          return Response.json({ error: "Server not configured" }, { status: 500 });
        }
        const authHeader = request.headers.get("authorization") ?? "";
        const match = /^Bearer\s+(.+)$/i.exec(authHeader);
        const provided = match ? match[1] : "";
        if (!provided || !timingSafeEqualStr(provided, expected)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!isPlainObject(parsed)) {
          return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
        }
        const body = parsed as LeadBody;

        const idempotency_key =
          typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
        if (!idempotency_key) {
          return Response.json(
            { error: "idempotency_key is required" },
            { status: 400 },
          );
        }

        const row: Record<string, unknown> = {
          resort_id: RESORT_ID,
          channel: CHANNEL,
          status: STATUS,
          idempotency_key,
        };
        const stringFields = [
          "guest_name",
          "guest_email",
          "phone",
          "check_in",
          "check_out",
          "room_tier_id",
          "room_tier_name",
          "room_preference",
          "special_requests",
          "notes",
        ] as const;
        for (const k of stringFields) {
          const v = body[k];
          if (typeof v === "string" && v.length > 0) row[k] = v;
        }
        const numberFields = ["guests_count", "children_count", "total_nights"] as const;
        for (const k of numberFields) {
          const v = body[k];
          if (typeof v === "number" && Number.isFinite(v)) row[k] = v;
        }
        if (typeof body.transport_needed === "boolean") {
          row.transport_needed = body.transport_needed;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await supabaseAdmin
          .from("booking_inquiries")
          .insert(row)
          .select("id, reference, status")
          .single();

        if (!error && data) {
          return Response.json(
            { ok: true, id: data.id, reference: data.reference, status: data.status },
            { status: 201 },
          );
        }

        const isUniqueViolation =
          !!error &&
          ((error as { code?: string }).code === "23505" ||
            /duplicate key|unique/i.test(error.message ?? ""));
        if (isUniqueViolation) {
          const { data: existing, error: fetchErr } = await supabaseAdmin
            .from("booking_inquiries")
            .select("id, reference, status")
            .eq("resort_id", RESORT_ID)
            .eq("idempotency_key", idempotency_key)
            .maybeSingle();
          if (!fetchErr && existing) {
            return Response.json(
              {
                ok: true,
                duplicate: true,
                id: existing.id,
                reference: existing.reference,
                status: existing.status,
              },
              { status: 200 },
            );
          }
        }

        console.error("[ops/guest-lead] insert failed", error);
        return Response.json({ error: "Failed to create lead" }, { status: 500 });
      },
    },
  },
});
