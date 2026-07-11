export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function verifyAdminPasskey(passkey: string) {
  const expected = process.env.ADMIN_PASSKEY;
  if (!expected) throw new Error("ADMIN_PASSKEY not configured");
  if (passkey !== expected) throw new Error("Unauthorized");
}
