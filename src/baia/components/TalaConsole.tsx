/**
 * TalaConsole — the owner-facing TALA agent console (admin panel tab).
 *
 * Replaces the old "Hermes Workforce" panel, which rendered hardcoded mock
 * data. Everything here is real:
 *
 *   - Status cards come from getTalaStatus(): which provider is live, how
 *     much knowledge TALA has, pending booking inquiries, recent actions.
 *   - The chat talks to talaChat({surface: "admin"}) with the admin passkey
 *     from SiteContext — the SAME brain guests get, but with write tools
 *     (site content, knowledge, bookings, rooms, tasks). Tool executions
 *     appear as evidence chips under each reply.
 *   - The action log is the tala_action_log evidence trail (every tool call
 *     TALA has made, guest or admin surface).
 *
 * No fake agents, no fake jobs — one agent, real actions, full trail.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  RefreshCw,
  Sparkles,
  Bot,
  Database,
  BookOpen,
  Inbox,
  Activity as ActivityIcon,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Wand2,
  ListChecks,
  PenLine,
  Home,
  Phone,
} from "lucide-react";
import { useSite } from "../context/SiteContext";
import { talaChat, getTalaStatus, getTalaActionLog } from "../tala/tala.server";
import type { TalaStatus, TalaActionLogEntry, TalaAction } from "../tala/tala.types";

interface ChatMsg {
  role: "owner" | "tala";
  content: string;
  actions?: TalaAction[];
  brain?: string;
}

const SUGGESTIONS = [
  "Give me today's pulse report",
  "Show the pending booking inquiries",
  "Mark inquiry BAIA-123456 as confirmed",
  "Set Comfort Cottage 1 to maintenance",
  "Create a cleaning task for the Deluxe Beachfront Suite",
  "Add a knowledge entry: sunset boat trips run 16:30 daily, weather permitting",
];

function newSessionId(): string {
  return "admin_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ActionChip({ action }: { action: TalaAction }) {
  const ok = action.status === "success";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-mono tracking-wide ${
        ok
          ? "border-emerald-800/60 text-emerald-300 bg-emerald-950/40"
          : "border-red-900/60 text-red-300 bg-red-950/40"
      }`}
      title={action.evidenceJson || action.name}
    >
      {ok ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
      {action.name}
    </span>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-luxury-900/60 border border-luxury-800 rounded-sm p-3">
      <div className="flex items-center gap-1.5 text-luxury-400 mb-1.5">
        <Icon size={11} />
        <span className="text-[9px] tracking-widest uppercase font-sans font-bold">{label}</span>
      </div>
      <div className="text-gold-300 text-sm font-sans font-semibold leading-tight">{value}</div>
      {sub && <div className="text-[9px] text-luxury-500 font-sans mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

export function TalaConsole() {
  const { adminPasskey } = useSite();
  const [status, setStatus] = useState<TalaStatus | null>(null);
  const [log, setLog] = useState<TalaActionLogEntry[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "tala",
      content:
        "Kumusta! I'm TALA — your operations agent. I can report on bookings, edit site content, manage the knowledge base, and update rooms and tasks. Ask me anything, or try one of the suggestions below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef(newSessionId());
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (passkey: string | null) => {
    setLoadingStatus(true);
    try {
      const s = await getTalaStatus();
      setStatus(s);
      if (passkey) {
        const res = await getTalaActionLog({ data: { passkey, limit: 25 } });
        if (res.ok) setLog(res.entries ?? []);
      }
    } catch (e) {
      console.error("TALA status failed", e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refresh(adminPasskey);
  }, [adminPasskey, refresh]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    if (!adminPasskey) {
      setMessages((prev) => [
        ...prev,
        { role: "owner", content: q },
        {
          role: "tala",
          content:
            "I need the admin passkey before I can act. Close this panel, unlock admin access, and I'll be ready.",
          brain: "error",
        },
      ]);
      return;
    }
    const history = messages
      .filter((m) => m.role === "owner" || m.content)
      .slice(-10)
      .map((m) => ({
        role: (m.role === "owner" ? "guest" : "agent") as "guest" | "agent",
        content: m.content,
      }));

    setMessages((prev) => [...prev, { role: "owner", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await talaChat({
        data: {
          message: q,
          sessionId: sessionId.current,
          surface: "admin",
          passkey: adminPasskey,
          history,
        },
      });
      setMessages((prev) => [
        ...prev,
        { role: "tala", content: res.reply, actions: res.actions, brain: res.brain },
      ]);
      // Actions may have changed counts — cheap refresh.
      refresh(adminPasskey);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "tala",
          content: "Something went wrong reaching my brain just now. Try again in a moment.",
          brain: "error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const statusDot =
    status?.status === "online"
      ? "bg-emerald-500"
      : status?.status === "degraded"
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-gold-300">
            <Sparkles size={14} />
            <h3 className="text-xs tracking-widest uppercase font-sans font-bold">
              TALA — Agent Console
            </h3>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse`} />
            <span className="text-[9px] tracking-widest uppercase font-sans text-luxury-400">
              {loadingStatus ? "checking…" : (status?.status ?? "unknown")}
            </span>
          </div>
          <p className="text-[10px] text-luxury-500 font-sans mt-1 max-w-xl leading-snug">
            One brain, two surfaces: the same agent guests chat with, unlocked here with write tools
            — site content, knowledge, bookings, rooms and tasks. Every action is logged with
            evidence.
          </p>
        </div>
        <button
          onClick={() => refresh(adminPasskey)}
          className="flex items-center gap-1.5 text-[9px] tracking-widest uppercase font-sans text-luxury-300 border border-luxury-800 hover:border-gold-300 hover:text-gold-300 rounded-sm px-2.5 py-1.5 transition-all cursor-pointer"
        >
          <RefreshCw size={10} className={loadingStatus ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatusCard
          icon={Bot}
          label="Brain"
          value={
            status
              ? status.provider === "none"
                ? "Deterministic"
                : status.provider === "openrouter"
                  ? "OpenRouter"
                  : "Ollama"
              : "…"
          }
          sub={
            status?.model && status.provider !== "none"
              ? status.model
              : "No LLM — knowledge layer only"
          }
        />
        <StatusCard
          icon={BookOpen}
          label="Knowledge"
          value={status ? `${status.knowledgeEntries} entries` : "…"}
          sub={status ? `+ ${status.staticTopics} built-in topics` : undefined}
        />
        <StatusCard
          icon={Inbox}
          label="Pending inquiries"
          value={status ? String(status.pendingInquiries) : "…"}
          sub="Awaiting owner confirmation"
        />
        <StatusCard
          icon={ActivityIcon}
          label="Actions (24h)"
          value={status ? String(status.actionsLast24h) : "…"}
          sub={status?.databaseReachable ? "Tool executions logged" : "Log table not applied yet"}
        />
      </div>

      {/* Notes */}
      {status && status.notes.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-sm p-3 space-y-1.5">
          {status.notes.map((n, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-[10px] text-amber-200/90 font-sans leading-snug"
            >
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chat console */}
        <div className="lg:col-span-3 bg-luxury-900/30 border border-luxury-800 rounded-sm flex flex-col h-[520px]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-luxury-800">
            <Wand2 size={12} className="text-gold-300" />
            <span className="text-[10px] tracking-widest uppercase font-sans font-bold text-gold-300">
              Command TALA
            </span>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "owner" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-sm px-3 py-2 ${
                    m.role === "owner"
                      ? "bg-gold-500 text-white text-xs font-sans font-light leading-relaxed"
                      : "bg-luxury-900 border border-luxury-800 text-luxury-100 text-xs font-sans font-light leading-relaxed"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-luxury-800/70">
                      {m.actions.map((a, j) => (
                        <ActionChip key={j} action={a} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 flex items-center gap-2 text-luxury-400">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-gold-300 animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-gold-300 animate-pulse [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-gold-300 animate-pulse [animation-delay:300ms]" />
                  </span>
                  <span className="text-[10px] font-sans">TALA is working…</span>
                </div>
              </div>
            )}
            {messages.length <= 1 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[10px] text-luxury-200 border border-luxury-800 hover:border-gold-300 hover:text-gold-300 rounded-sm px-2.5 py-1.5 transition-all cursor-pointer font-sans"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-luxury-800 p-3 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask TALA to check, change, or create something…"
              className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-gold-500 hover:bg-gold-600 text-white rounded-sm px-3 py-2 disabled:opacity-40 cursor-pointer"
              aria-label="Send to TALA"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Action log + capabilities */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-luxury-900/30 border border-luxury-800 rounded-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-luxury-800">
              <ListChecks size={12} className="text-gold-300" />
              <span className="text-[10px] tracking-widest uppercase font-sans font-bold text-gold-300">
                Action Trail
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-luxury-800/60">
              {log.length === 0 ? (
                <div className="px-4 py-6 text-center text-[10px] text-luxury-500 font-sans leading-snug">
                  {adminPasskey
                    ? "No actions logged yet. Apply supabase/manual_sql/004_tala_agent.sql to record every tool execution."
                    : "Unlock admin access to view the trail."}
                </div>
              ) : (
                log.map((entry) => (
                  <div key={entry.id} className="px-4 py-2 flex items-start gap-2">
                    {entry.status === "success" ? (
                      <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-luxury-100">{entry.tool}</span>
                        <span
                          className={`text-[8px] uppercase tracking-wider px-1 rounded ${
                            entry.surface === "admin"
                              ? "bg-gold-500/15 text-gold-300"
                              : "bg-luxury-800 text-luxury-300"
                          }`}
                        >
                          {entry.surface}
                        </span>
                        <span className="text-[8px] text-luxury-500 font-mono ml-auto flex items-center gap-0.5">
                          <Clock size={7} />
                          {entry.duration_ms}ms
                        </span>
                      </div>
                      {entry.result_summary && (
                        <p
                          className="text-[9px] text-luxury-500 font-mono truncate mt-0.5"
                          title={entry.result_summary ?? undefined}
                        >
                          {entry.result_summary}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-luxury-900/30 border border-luxury-800 rounded-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-luxury-800">
              <PenLine size={12} className="text-gold-300" />
              <span className="text-[10px] tracking-widest uppercase font-sans font-bold text-gold-300">
                Capabilities
              </span>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div>
                <div className="flex items-center gap-1.5 text-luxury-400 mb-1">
                  <Phone size={9} />
                  <span className="text-[9px] tracking-widest uppercase font-sans font-bold">
                    Guest surface
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(status?.tools.guest ?? []).map((t) => (
                    <span
                      key={t}
                      className="text-[8px] font-mono text-luxury-300 border border-luxury-800 rounded-sm px-1 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-luxury-400 mb-1">
                  <Database size={9} />
                  <span className="text-[9px] tracking-widest uppercase font-sans font-bold">
                    Admin surface
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(status?.tools.admin ?? []).map((t) => (
                    <span
                      key={t}
                      className="text-[8px] font-mono text-gold-200/80 border border-gold-500/25 rounded-sm px-1 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
