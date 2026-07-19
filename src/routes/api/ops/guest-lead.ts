import { createFileRoute } from "@tanstack/react-router";
import {
  handleCreateGuestLead,
  verifyOnyxOpsSecret,
  OpsError,
  type GuestLeadInput,
} from "../../../baia/ops/guest-lead.server";

/**
 * POST /api/ops/guest-lead
 *
 * The controlled MerQato operations endpoint that the Onyx `create_guest_lead`
 * custom tool calls. Server-only. Authenticated by ONYX_OPERATIONS_API_SECRET.
 * The browser never calls this; only the Onyx runtime (server-to-server) does.
 */

export const Route = createFileRoute("/api/ops/guest-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          verifyOnyxOpsSecret(request.headers.get("authorization"));

          let body: GuestLeadInput;
          try {
            body = (await request.json()) as GuestLeadInput;
          } catch {
            return json({ ok: false, error: "Invalid JSON body" }, 400);
          }

          const evidence = await handleCreateGuestLead(body);
          return json(evidence, 200);
        } catch (err) {
          if (err instanceof OpsError) {
            return json({ ok: false, error: err.message }, err.status);
          }
          const msg = err instanceof Error ? err.message : "Unknown error";
          return json({ ok: false, error: msg }, 500);
        }
      },
    },
  },
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
