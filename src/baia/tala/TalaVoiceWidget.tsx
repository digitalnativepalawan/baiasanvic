/**
 * TalaVoiceWidget — voice front-end for TALA.
 *
 * The old version POSTed audio to /api/tala/voice, a route that proxied to a
 * Python service on localhost:8100 — it could never work deployed. This
 * version uses the browser's built-in Web Speech APIs (SpeechRecognition for
 * listening, speechSynthesis for speaking) and sends the recognized text
 * through the same `talaChat` server function the admin console uses — one
 * brain, every surface, no external service.
 *
 * Where Web Speech isn't available (e.g. Firefox), the widget silently
 * degrades to text chat with a small note — voice is an enhancement, never a
 * requirement. TypeScript definitions for the speech APIs are declared
 * locally below so no extra dependency is needed.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Mic, MicOff, X, Sparkles, Loader2, Volume2 } from "lucide-react";
import { talaChat } from "./tala.server";

interface Message {
  role: "guest" | "agent";
  content: string;
}

// ---- Minimal Web Speech typings (not in lib.dom for all TS versions) --------
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number } & Record<number, SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SUGGESTIONS = [
  "What rooms do you have?",
  "What can I do around the island?",
  "How do I get there from Puerto Princesa?",
];

export function TalaVoiceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const sessionId = useRef(`voice_${Date.now().toString(36)}`);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speechAvailable = !!getRecognition();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const speak = useCallback(
    (text: string) => {
      if (!speakReplies || typeof window === "undefined" || !window.speechSynthesis) return;
      // Strip markdown-ish characters so it reads naturally.
      const clean = text.replace(/[*_`#>]/g, "");
      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.02;
      utter.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    },
    [speakReplies],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || isLoading) return;
      setMessages((prev) => [...prev, { role: "guest", content: q }]);
      setInput("");
      setIsLoading(true);
      try {
        const res = await talaChat({
          data: {
            message: q,
            sessionId: sessionId.current,
            surface: "guest",
            history: [],
          },
        });
        if (res.reply) {
          setMessages((prev) => [...prev, { role: "agent", content: res.reply }]);
          speak(res.reply);
        }
      } catch (err) {
        console.error("TALA chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content:
              "I couldn't reach the team just now — please email hello@baiapalawan.com or use Book Your Stay.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, speak],
  );

  const startRecording = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor || isRecording) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      if (result?.isFinal) {
        const transcript = result[0].transcript.trim();
        if (transcript) sendMessage(transcript);
      }
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    recognitionRef.current = rec;
    setIsRecording(true);
    rec.start();
  }, [isRecording, sendMessage]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[54] bg-luxury-950 border border-gold-500/40 hover:border-gold-400 text-gold-300 rounded-full shadow-xl w-11 h-11 flex items-center justify-center cursor-pointer transition-all"
        title="Talk to TALA"
        aria-label="Open TALA voice chat"
      >
        <Mic size={18} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-[54] w-[min(92vw,360px)] h-[min(75vh,520px)] bg-luxury-950 border border-luxury-800 rounded-sm shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-luxury-900 border-b border-luxury-800">
        <div className="flex items-center gap-2 text-gold-300">
          <Sparkles size={15} />
          <span className="text-[11px] tracking-widest uppercase font-sans font-bold">
            TALA · Voice
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSpeakReplies((v) => !v)}
            className={`cursor-pointer transition-colors ${speakReplies ? "text-gold-300" : "text-luxury-600"}`}
            title={speakReplies ? "Replies are spoken" : "Replies are silent"}
            aria-label="Toggle spoken replies"
          >
            <Volume2 size={15} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-luxury-400 hover:text-gold-300 cursor-pointer"
            aria-label="Close TALA voice"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-luxury-400 text-xs font-sans font-light leading-relaxed">
            <p className="mb-3">
              Kumusta! I'm TALA.{" "}
              {speechAvailable
                ? "Tap the mic and speak, or type below."
                : "Type below — voice input isn't supported in this browser."}
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-[11px] text-luxury-100 border border-luxury-800 hover:border-gold-300 hover:text-gold-300 rounded-sm px-3 py-2 transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "guest" ? "justify-end" : "justify-start"}`}>
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
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 flex items-center gap-2 text-luxury-400">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-xs font-sans font-light">Listening for the answer…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-luxury-800 p-3 flex items-center gap-2 bg-luxury-950"
      >
        {speechAvailable && (
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            className={`rounded-sm p-2 transition-all cursor-pointer disabled:opacity-40 ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-luxury-900 border border-luxury-800 text-gold-300 hover:border-gold-300"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask TALA…"
          className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-gold-500 hover:bg-gold-600 text-white rounded-sm px-3 py-2 disabled:opacity-40 cursor-pointer"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
