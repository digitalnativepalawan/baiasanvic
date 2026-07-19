/**
 * Standalone proof harness — exposes the REAL BAIA ops handler over HTTP so the
 * real Onyx CustomTool can call it exactly as it would call the TanStack route
 * /api/ops/guest-lead. This wraps the identical handler module the route uses;
 * it does NOT reimplement any logic. Runs the TEST persistence adapter because
 * Supabase tables are UNCONFIRMED.
 */
import http from "node:http";
import {
  handleCreateGuestLead,
  verifyOnyxOpsSecret,
  OpsError,
} from "../src/baia/ops/guest-lead.server.ts";

const PORT = Number(process.env.PROOF_PORT ?? 8791);

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/api/ops/guest-lead")) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      verifyOnyxOpsSecret(req.headers["authorization"] ?? null);
      const body = JSON.parse(raw || "{}");
      const evidence = await handleCreateGuestLead(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(evidence));
    } catch (err) {
      const status = err instanceof OpsError ? err.status : 500;
      const message = err instanceof Error ? err.message : "Unknown error";
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`PROOF_OPS_SERVER_LISTENING http://127.0.0.1:${PORT}/api/ops/guest-lead`);
});
