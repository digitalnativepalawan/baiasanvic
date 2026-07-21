/**
 * Persists guest/agent chat turns to the server-only `concierge_log` table.
 * Lets the owner later review what guests actually asked. Writes via the
 * service-role client; the table is not exposed to the browser.
 */
export interface ConciergeLogEntry {
  sessionId: string;
  role: "guest" | "agent";
  content: string;
  source?: "core" | "onyx";
  onyxError?: string;
}

export async function logConciergeTurn(
  sessionId: string,
  role: "guest" | "agent",
  content: string,
  opts?: { source?: "core" | "onyx"; onyxError?: string },
): Promise<void> {
  try {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await supabaseAdmin.from("concierge_log").insert({
      session_id: sessionId,
      role,
      content,
      created_at: new Date().toISOString(),
      ...(opts?.source && { source: opts.source }),
      ...(opts?.onyxError && { onyx_error: opts.onyxError }),
    });
  } catch {
    // Logging is best-effort; never break the chat if the table is missing.
  }
}

/**
 * Log an Onyx-specific error
 */
export async function logOnyxError(
  sessionId: string,
  error: string,
): Promise<void> {
  return logConciergeTurn(sessionId, "agent", "", {
    source: "onyx",
    onyxError: error,
  });
}