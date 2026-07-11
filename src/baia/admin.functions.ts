import { createServerFn } from "@tanstack/react-start";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  verifyAdminPasskey,
} from "./admin.server";

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
    verifyAdminPasskey(data.passkey);

    const contentType = (data.contentType || "").toLowerCase();
    const isImage = ALLOWED_IMAGE_MIME_TYPES.has(contentType);
    const isVideo = ALLOWED_VIDEO_MIME_TYPES.has(contentType);
    if (!isImage && !isVideo) {
      throw new Error(
        "Unsupported file type. Use WEBP, PNG, JPG/JPEG, SVG for images or MP4/WEBM for videos.",
      );
    }

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength === 0) throw new Error("Empty file");
    const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (bytes.byteLength > cap) {
      throw new Error(
        `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB). Max ${cap / 1024 / 1024} MB.`,
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

    return { url: `/api/site-assets/${path}`, path };
  });

export const saveSiteState = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string; state: unknown }) => data)
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
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
