/**
 * Persists guest/agent chat turns to the server-only `concierge_log` table.
 * Lets the owner later review what guests actually asked. Writes via the
 * service-role client; the table is not exposed to the browser.
 */
export async function logConciergeTurn(
  sessionId: string,
  role: "guest" | "agent",
  content: string,
): Promise<void> {
  try {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    await supabaseAdmin.from("concierge_log").insert({
      session_id: sessionId,
      role,
      content,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Logging is best-effort; never break the chat if the table is missing.
  }
}
