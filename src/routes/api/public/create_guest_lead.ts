import { createFileRoute } from "@tanstack/react-router";

/**
 * Public endpoint for Onyx to create a guest lead in `public.booking_inquiries`.
 * Auth: shared secret via `x-onyx-secret` header (matches ONYX_WEBHOOK_SECRET).
 * Method: POST with JSON body. All fields optional except we default status=pending.
 */

type LeadBody = {
  guest_name?: string | null;
  guest_email?: string | null;
  phone?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  guests_count?: number | null;
  children_count?: number | null;
  total_nights?: number | null;
  total_price?: number | null;
  room_tier_id?: string | null;
  room_tier_name?: string | null;
  room_preference?: string | null;
  special_requests?: string | null;
  notes?: string | null;
  transport_needed?: boolean | null;
  idempotency_key?: string | null;
  channel?: string | null;
};

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/create_guest_lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ONYX_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Server not configured", { status: 500 });
        }
        const provided = request.headers.get("x-onyx-secret") ?? "";
        if (!timingSafeEqualStr(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: LeadBody;
        try {
          body = (await request.json()) as LeadBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const row: Record<string, unknown> = {
          status: "pending",
          channel: body.channel ?? "onyx",
        };
        const passthrough: (keyof LeadBody)[] = [
          "guest_name",
          "guest_email",
          "phone",
          "check_in",
          "check_out",
          "guests_count",
          "children_count",
          "total_nights",
          "total_price",
          "room_tier_id",
          "room_tier_name",
          "room_preference",
          "special_requests",
          "notes",
          "transport_needed",
          "idempotency_key",
        ];
        for (const k of passthrough) {
          const v = body[k];
          if (v !== undefined && v !== null) row[k] = v;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("booking_inquiries")
          .insert(row)
          .select("id, reference, status, created_at")
          .single();

        if (error) {
          console.error("[create_guest_lead] insert failed", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json(
          { ok: true, id: data.id, reference: data.reference, status: data.status },
          { status: 201 },
        );
      },
    },
  },
});
