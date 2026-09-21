"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { streamChat } from "@/lib/streamChat";

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  model_used: string | null;
  created_at: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<ChatSession[]>("/chat/sessions").then((rows) => {
      setSessions(rows);
      if (rows.length > 0) selectSession(rows[0].id);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  async function selectSession(id: number) {
    setActiveId(id);
    setErrorText(null);
    setStreamingText(null);
    const rows = await api.get<ChatMessage[]>(`/chat/sessions/${id}/messages`);
    setMessages(rows);
  }

  async function newChat() {
    const session = await api.post<ChatSession>("/chat/sessions", { title: "New chat" });
    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    setMessages([]);
    setErrorText(null);
    setStreamingText(null);
  }

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;

    let sessionId = activeId;
    if (sessionId == null) {
      const session = await api.post<ChatSession>("/chat/sessions", { title: content.slice(0, 48) });
      setSessions((prev) => [session, ...prev]);
      sessionId = session.id;
      setActiveId(sessionId);
    }

    setDraft("");
    setErrorText(null);
    setMessages((prev) => [...prev, { id: -1, role: "user", content, model_used: null, created_at: new Date().toISOString() }]);
    setSending(true);
    setStreamingText("");

    await streamChat(sessionId, content, "chat", {
      onToken: (text) => setStreamingText((prev) => (prev ?? "") + text),
      onDone: ({ provider, model }) => {
        setStreamingText((current) => {
          setMessages((prev) => [
            ...prev,
            { id: -2, role: "assistant", content: current ?? "", model_used: `${provider}:${model}`, created_at: new Date().toISOString() },
          ]);
          return null;
        });
        setSending(false);
      },
      onError: (message) => {
        setErrorText(message);
        setStreamingText(null);
        setSending(false);
      },
    });
  }

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-[280px] shrink-0 border-r flex flex-col py-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 pb-4">
          <span className="text-[13px] font-semibold">Conversations</span>
          <button
            aria-label="New chat"
            onClick={newChat}
            className="w-[26px] h-[26px] rounded-lg border flex items-center justify-center cursor-pointer"
            style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col px-3 gap-0.5 overflow-y-auto">
          {sessions.length === 0 && (
            <span className="text-xs px-2 py-2" style={{ color: "var(--text-3)" }}>No conversations yet — send a message to start one.</span>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              className="flex flex-col gap-0.5 px-2 py-2.5 rounded-[10px] text-left cursor-pointer"
              style={{ background: s.id === activeId ? "var(--surface)" : "transparent", border: s.id === activeId ? "1px solid var(--border)" : "1px solid transparent" }}
            >
              <span className="text-[13px] font-medium truncate" style={{ color: s.id === activeId ? "var(--text)" : "var(--text-2)" }}>{s.title}</span>
              <span className="tr7-mono text-[10px]" style={{ color: "var(--text-3)" }}>{new Date(s.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-8 py-[22px] border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold">{activeSession?.title ?? "New conversation"}</span>
            <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Routes per task — see Settings → Model routing</span>
          </div>
          <div className="flex items-center gap-2 rounded-[10px] border px-3.5 py-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
            <span className="text-[12.5px]">Auto · routes per task</span>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 px-8 py-7 flex flex-col gap-5 overflow-y-auto">
          {messages.length === 0 && streamingText === null && (
            <span className="text-sm m-auto" style={{ color: "var(--text-3)" }}>Ask anything, or paste a prediction to compare.</span>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[480px] rounded-[14px] rounded-br-[2px] px-4 py-3 border" style={{ background: "#2B2013", borderColor: "#3C2C18" }}>
                  <span className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{m.content}</span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-1.5 max-w-[560px]">
                <div className="rounded-[14px] rounded-bl-[2px] px-4 py-3.5 tr7-card">
                  <span className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{m.content}</span>
                </div>
                {m.model_used && <span className="tr7-mono text-[10.5px] pl-1" style={{ color: "var(--text-3)" }}>{m.model_used.replace(":", " · ")}</span>}
              </div>
            )
          )}

          {streamingText !== null && (
            <div className="flex flex-col gap-1.5 max-w-[560px]">
              <div className="rounded-[14px] rounded-bl-[2px] px-4 py-3.5 tr7-card">
                <span className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                  {streamingText || "…"}
                </span>
              </div>
              <span className="tr7-mono text-[10.5px] pl-1" style={{ color: "var(--positive)" }}>streaming...</span>
            </div>
          )}

          {errorText && (
            <div className="flex flex-col gap-1.5 max-w-[560px]">
              <div className="rounded-[14px] rounded-bl-[2px] px-4 py-3.5 border" style={{ background: "var(--danger-bg)", borderColor: "var(--danger)" }}>
                <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--danger)" }}>{errorText}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 pb-7 pt-5">
          <div className="flex items-center gap-2.5 rounded-[14px] border pl-4 pr-2.5 py-2" style={{ background: "var(--surface)", borderColor: "var(--border-2)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              type="text"
              placeholder="Ask anything, or paste a prediction to compare..."
              className="flex-1 bg-transparent outline-none text-[13.5px]"
              style={{ color: "var(--text)" }}
            />
            <span className="text-[11px] px-1" style={{ color: "var(--text-3)" }}>Auto</span>
            <button
              aria-label="Send message"
              onClick={send}
              disabled={!draft.trim() || sending}
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
