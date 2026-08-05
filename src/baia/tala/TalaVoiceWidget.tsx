import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Mic, MicOff, X, MessageCircle } from "lucide-react";

interface Message {
  role: "guest" | "agent";
  content: string;
  timestamp: Date;
}

export function TalaVoiceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const sessionId = useRef(`session_${Date.now()}`);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const guestMsg: Message = { role: "guest", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, guestMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/tala/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId.current }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentMsg: Message = { role: "agent", content: data.reply, timestamp: new Date() };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err) {
      console.error("TALA chat error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          try {
            const res = await fetch("/api/tala/voice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64,
                sessionId: sessionId.current,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.transcription) {
                setMessages((prev) => [
                  ...prev,
                  { role: "guest", content: data.transcription, timestamp: new Date() },
                ]);
              }
              if (data.reply) {
                setMessages((prev) => [
                  ...prev,
                  { role: "agent", content: data.reply, timestamp: new Date() },
                ]);
              }
              if (data.audioBase64) {
                const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
                audio.play();
              }
            }
          } catch (err) {
            console.error("Voice error:", err);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  }, []);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-xl z-50 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-lg">TALA Assistant</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Hi! I'm TALA, your BAIA assistant. Ask me anything about the resort, activities, or San Vicente.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === "guest" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "guest"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
      </CardContent>
      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask TALA..."
          className="flex-1"
        />
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button size="icon" onClick={() => sendMessage(input)}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
