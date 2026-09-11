/**
 * ConciergeWidget — the guest-facing chat UI for TALA.
 *
 * TALA is the agent behind this widget (same brain as the admin console):
 * the guest surface runs the guarded pipeline — lead capture, price
 * guardrails, deterministic knowledge, then the optional agentic loop with
 * read-only tools. Talks only to the server function `conciergeChat`; the
 * provider key never leaves the server.
 *
 * Action chips: when TALA used tools (checked rooms, saved an inquiry…), the
 * response carries an evidence trail the widget renders as small chips under
 * the reply — visible proof the agent actually did something.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, MessageCircle, Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { conciergeChat } from "../concierge.server";
import type { ConciergeMessage, ConciergeResponse } from "../concierge.types";

interface ConciergeWidgetProps {
  // Optional initial opener (e.g. from a CTA button that wants to pre-open it).
  open?: boolean;
  onClose?: () => void;
}

const SUGGESTIONS = [
  "What rooms do you have?",
  "What experiences can you arrange?",
  "How do I get there?",
  "How do I book?",
];

function newSessionId(): string {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function ActionChip({ name, ok }: { name: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-mono tracking-wide border ${
        ok
          ? "border-emerald-800/60 text-emerald-300/90 bg-emerald-950/30"
          : "border-red-900/50 text-red-300/80 bg-red-950/30"
      }`}
    >
      {ok ? <CheckCircle2 size={8} /> : <XCircle size={8} />}
      {name}
    </span>
  );
}

interface AgentMessage {
  content: string;
  actions?: ConciergeResponse["actions"];
}

export default function ConciergeWidget({ open = false, onClose }: ConciergeWidgetProps) {
  const [visible, setVisible] = useState(open);
  const [messages, setMessages] = useState<
    Array<{ role: "guest" | "agent" } & Partial<AgentMessage>>
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(() => newSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVisible(open), [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ConciergeMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content ?? "" }) as ConciergeMessage),
      { role: "guest", content: q },
    ];
    setMessages((prev) => [...prev, { role: "guest", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await conciergeChat({ data: { messages: next, sessionId } });
      setMessages((prev) => [...prev, { role: "agent", content: res.reply, actions: res.actions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content:
            "I couldn't reach the concierge just now. Please email hello@baiapalawan.com or tap Book Your Stay and we'll help right away.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    <>
      {/* Floating launcher */}
      {!visible && (
        <button
          onClick={() => setVisible(true)}
          className="fixed bottom-6 right-6 z-[55] bg-gold-500 hover:bg-gold-600 text-white rounded-full shadow-2xl w-14 h-14 flex items-center justify-center cursor-pointer transition-all"
          title="Chat with TALA"
          aria-label="Open TALA chat"
        >
          <MessageCircle size={22} />
        </button>
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className="fixed bottom-6 right-6 z-[55] w-[min(92vw,380px)] h-[min(80vh,560px)] bg-luxury-950 border border-luxury-800 rounded-sm shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-luxury-900 border-b border-luxury-800">
              <div className="flex items-center gap-2 text-gold-300">
                <Sparkles size={16} />
                <span className="text-[11px] tracking-widest uppercase font-sans font-bold">
                  TALA · AI Island Concierge
                </span>
              </div>
              <button
                onClick={close}
                className="text-luxury-400 hover:text-gold-300 cursor-pointer"
                aria-label="Close concierge"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-luxury-400 text-xs font-sans font-light leading-relaxed">
                  <p className="mb-3">
                    Kumusta! I'm TALA, BAIA's AI concierge. Ask me about our rooms, experiences, the
                    island, or how to book — and I'll check our live info for you.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-[11px] text-luxury-100 border border-luxury-800 hover:border-gold-300 hover:text-gold-300 rounded-sm px-3 py-2 transition-all cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "guest" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] text-xs font-sans font-light leading-relaxed px-3 py-2 rounded-sm ${
                      m.role === "guest"
                        ? "bg-gold-500 text-white"
                        : "bg-luxury-900 text-luxury-100 border border-luxury-800"
                    }`}
                  >
                    {m.content}
                    {m.role === "agent" && m.actions && m.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-luxury-800/70">
                        {m.actions.map((a, j) => (
                          <ActionChip key={j} name={a.name} ok={a.status === "success"} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 flex items-center gap-2 text-luxury-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-xs font-sans font-light">Checking…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-luxury-800 p-3 flex items-center gap-2 bg-luxury-950"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask TALA…"
                className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="bg-gold-500 hover:bg-gold-600 text-white rounded-sm px-3 py-2 disabled:opacity-40 cursor-pointer"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
