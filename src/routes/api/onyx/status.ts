import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { OnyxStatus } from "@/baia/onyx/status.server";

const getOnyxStatusFn = createServerFn({ method: "GET" }).handler(async (): Promise<OnyxStatus> => {
  const { getOnyxStatus } = await import("@/baia/onyx/status.server");
  return getOnyxStatus();
});

export const Route = createFileRoute("/api/onyx/status")({
  server: {
    handlers: {
      GET: async () => {
        const status = await getOnyxStatusFn();
        return new Response(JSON.stringify(status), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});