import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY one-shot self-test for /api/ops/guest-lead.
 * Uses server-side ONYX_OPERATIONS_API_SECRET to prove the live contract.
 * DELETE this file after the proof completes.
 */

export const Route = createFileRoute("/api/ops/self-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = process.env.ONYX_OPERATIONS_API_SECRET;
        if (!gate) return Response.json({ error: "no secret" }, { status: 500 });

        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const endpoint = `${origin}/api/ops/guest-lead`;
        const idem = `selftest-${Date.now()}`;
        const payload = {
          idempotency_key: idem,
          guest_name: "Lovable Self-Test",
          guest_email: "selftest@baia.internal",
          notes: "one-shot proof; will be deleted",
          guests_count: 2,
        };

        const call = async () =>
          fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${gate}`,
            },
            body: JSON.stringify(payload),
          }).then(async (r) => ({ status: r.status, body: await r.json() }));

        const first = await call();
        const second = await call();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const firstId =
          (first.body as { id?: string } | undefined)?.id ?? null;
        const stored = firstId
          ? await supabaseAdmin
              .from("booking_inquiries")
              .select("id, reference, status, resort_id, channel, idempotency_key, guest_name")
              .eq("id", firstId)
              .maybeSingle()
          : { data: null, error: null };

        let deleted: { count: number | null; error: string | null } = {
          count: null,
          error: null,
        };
        if (firstId) {
          const del = await supabaseAdmin
            .from("booking_inquiries")
            .delete()
            .eq("id", firstId)
            .select("id");
          deleted = {
            count: del.data?.length ?? 0,
            error: del.error?.message ?? null,
          };
        }

        const after = firstId
          ? await supabaseAdmin
              .from("booking_inquiries")
              .select("id")
              .eq("id", firstId)
              .maybeSingle()
          : { data: null, error: null };

        return Response.json({
          endpoint,
          idempotency_key: idem,
          first,
          second,
          stored: stored.data,
          deleted,
          remaining_after_delete: after.data,
        });
      },
    },
  },
});
