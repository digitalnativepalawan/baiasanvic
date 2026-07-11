import { createServerFn } from "@tanstack/react-start";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);
const MAX_BYTES = 5 * 1024 * 1024;

function verifyPasskey(passkey: string) {
  const expected = process.env.ADMIN_PASSKEY;
  if (!expected) throw new Error("ADMIN_PASSKEY not configured");
  if (passkey !== expected) throw new Error("Unauthorized");
}

export const uploadSiteAsset = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      passkey: string;
      filename: string;
      contentType: string;
      base64: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    verifyPasskey(data.passkey);

    const contentType = (data.contentType || "").toLowerCase();
    if (!ALLOWED_MIME.has(contentType)) {
      throw new Error(
        "Unsupported file type. Allowed: PNG, JPEG, WEBP, GIF, SVG.",
      );
    }

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength === 0) throw new Error("Empty file");
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error(
        `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB). Max 5 MB.`,
      );
    }

    const ext = (data.filename.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("site-assets")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabaseAdmin.storage
      .from("site-assets")
      .getPublicUrl(path);

    return { url: pub.publicUrl, path };
  });

export const saveSiteState = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string; state: unknown }) => data)
  .handler(async ({ data }) => {
    verifyPasskey(data.passkey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_state")
      .upsert(
        {
          key: "default",
          data: data.state as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(`Save failed: ${error.message}`);
    return { ok: true };
  });
