import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/site-assets/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const rawPath = params._splat || "";
        const objectPath = rawPath
          .split("/")
          .map((part) => decodeURIComponent(part))
          .filter(Boolean)
          .join("/");

        if (!objectPath || objectPath.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await supabase.storage
          .from("site-assets")
          .download(objectPath);

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        const buf = await data.arrayBuffer();
        const size = buf.byteLength;

        const headers = new Headers();
        if (data.type) headers.set("content-type", data.type);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        headers.set("accept-ranges", "bytes");

        const range = request.headers.get("range");
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          if (match) {
            const start = match[1] ? parseInt(match[1], 10) : 0;
            const end = match[2]
              ? Math.min(parseInt(match[2], 10), size - 1)
              : size - 1;
            if (Number.isNaN(start) || Number.isNaN(end) || start >= size || start > end) {
              headers.set("content-range", `bytes */${size}`);
              return new Response(null, { status: 416, headers });
            }
            const slice = buf.slice(start, end + 1);
            headers.set("content-range", `bytes ${start}-${end}/${size}`);
            headers.set("content-length", String(end - start + 1));
            return new Response(slice, { status: 206, headers });
          }
        }

        headers.set("content-length", String(size));
        return new Response(buf, { headers });
      },
    },
  },
});
