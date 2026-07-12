/**
 * ConciergeWidget — the guest-facing chat UI.
 *
 * Replaces the placeholder "Consult our Concierge" button behaviour with a
 * real chat panel. Talks only to the server function `conciergeChat`; the
 * provider key never leaves the server.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { conciergeChat } from "../concierge.server";
import type { ConciergeMessage } from "../concierge.types";

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

export default function ConciergeWidget({ open = false, onClose }: ConciergeWidgetProps) {
  const [visible, setVisible] = useState(open);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
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
    const next: ConciergeMessage[] = [...messages, { role: "guest", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await conciergeChat({ data: { messages: next, sessionId } });
      setMessages((prev) => [...prev, { role: "agent", content: res.reply }]);
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
          title="Chat with our concierge"
          aria-label="Open concierge chat"
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
                  BAIA Concierge
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
                    Kumusta! I'm BAIA's concierge. Ask me about our rooms, experiences,
                    the island, or how to book — I'll point you to the right place.
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
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 flex items-center gap-2 text-luxury-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-xs font-sans font-light">Thinking…</span>
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
                placeholder="Ask the concierge…"
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
