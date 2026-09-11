/**
 * TALA — BAIA's agent. One brain, two surfaces.
 *
 *   Guest surface  → the public site chat (ConciergeWidget / TalaVoiceWidget)
 *                    via conciergeChat / talaChat({surface: "guest"}).
 *   Admin surface  → the owner console (TalaConsole) via
 *                    talaChat({surface: "admin", passkey}) with write tools.
 *
 * The brain lives in ./agent (loop, tools, prompts, LLM dispatch) and runs
 * entirely in server functions — there is no external agent service.
 */
export { TalaVoiceWidget } from "./TalaVoiceWidget";
export { talaChat, getTalaStatus, getTalaActionLog } from "./tala.server";
export type * from "./tala.types";
export {
  runAgentLoop,
  runGuestTurn,
  runAdminTurn,
  type AgentLoopResult,
  type GuestTurnResult,
  type AdminTurnResult,
} from "./agent/tala.loop";
export {
  getToolsForSurface,
  listToolNames,
  toToolSchemas,
  executeTool,
  guestSafe,
  type ToolContext,
  type ToolDef,
  type ToolResult,
} from "./agent/tala.tools";
