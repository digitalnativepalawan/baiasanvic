export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

export function verifyAdminPasskey(passkey: string) {
  const expected = process.env.ADMIN_PASSKEY;
  if (!expected) throw new Error("ADMIN_PASSKEY not configured");
  if (passkey !== expected) throw new Error("Unauthorized");
}

// Backwards compat
export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES;
