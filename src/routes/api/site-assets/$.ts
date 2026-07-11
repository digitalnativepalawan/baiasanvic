import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/site-assets/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const rawPath = params._splat || "";
        const objectPath = rawPath
          .split("/")
          .map((part) => decodeURIComponent(part))
          .filter(Boolean)
          .join("/");

        if (!objectPath || objectPath.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("site-assets")
          .download(objectPath);

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        const headers = new Headers();
        if (data.type) headers.set("content-type", data.type);
        headers.set("cache-control", "public, max-age=31536000, immutable");

        return new Response(data, { headers });
      },
    },
  },
});
