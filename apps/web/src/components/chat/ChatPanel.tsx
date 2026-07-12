"use client";

/**
 * Ask Basilisk — floating chat launcher + panel.
 *
 * Talks NDJSON to /api/chat (text / tool / error / done lines), persists the
 * transcript in sessionStorage, and renders a minimal safe markdown subset
 * (**bold** + `inline code`) as React nodes — never dangerouslySetInnerHTML.
 *
 * Mount once near the root layout; renders nothing until opened.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types + storage
// ---------------------------------------------------------------------------

type Part =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; label: string }
  | { kind: "notice"; text: string; color: string };

interface UiMessage {
  role: "user" | "assistant";
  parts: Part[];
}

const STORAGE_KEY = "basilisk.chat";
const MAX_INPUT = 2000;
const HISTORY_CAP = 10;

const SUGGESTIONS = [
  "What's trending on Cardano today?",
  "Which token has the most buy pressure?",
  "Profile the wallet $wes",
  "How's SNEK looking?",
];

function loadStored(): UiMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is UiMessage =>
        typeof m === "object" &&
        m !== null &&
        ((m as UiMessage).role === "user" || (m as UiMessage).role === "assistant") &&
        Array.isArray((m as UiMessage).parts)
    );
  } catch {
    return [];
  }
}

function flatText(m: UiMessage): string {
  return m.parts
    .filter((p): p is Extract<Part, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join("")
    .trim();
}

/** History for the API: plain {role, content}, capped, first turn = user. */
function toApiMessages(items: UiMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  const flattened = items
    .map((m) => ({ role: m.role, content: flatText(m).slice(0, MAX_INPUT) }))
    .filter((m) => m.content.length > 0)
    .slice(-HISTORY_CAP);
  while (flattened.length > 0 && flattened[0]!.role !== "user") flattened.shift();
  return flattened;
}

// ---------------------------------------------------------------------------
// Minimal markdown (**bold** + `inline code`) → React nodes, no HTML injection
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} style={{ fontWeight: 700, color: "#FFFFFF" }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <code
          key={key++}
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: "12px",
            background: "#1A1A1D",
            border: "1px solid #24242C",
            borderRadius: "4px",
            padding: "1px 4px",
            color: "#20EB7A",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ---------------------------------------------------------------------------
// Icons (stroke SVG only)
// ---------------------------------------------------------------------------

function ChatBubbleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
        stroke="#001A0E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="#001A0E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
        stroke="#9898A1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V5m0 0-6 6m6-6 6 6"
        stroke="#001A0E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        stroke="#6B6B73"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hoverLauncher, setHoverLauncher] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const restoredRef = useRef(false);

  // Restore transcript after mount (sessionStorage is browser-only).
  useEffect(() => {
    setMessages(loadStored());
    restoredRef.current = true;
  }, []);

  // Persist on change.
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage full / private mode — non-fatal
    }
  }, [messages]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, open]);

  // Abort in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const appendToAssistant = useCallback((updater: (parts: Part[]) => Part[]) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const lastIdx = next.length - 1;
      const last = next[lastIdx]!;
      if (last.role !== "assistant") return prev;
      next[lastIdx] = { ...last, parts: updater(last.parts) };
      return next;
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, MAX_INPUT);
      if (!trimmed || streaming) return;

      const userMsg: UiMessage = { role: "user", parts: [{ kind: "text", text: trimmed }] };
      const assistantMsg: UiMessage = { role: "assistant", parts: [] };
      const apiMessages = toApiMessages([...messages, userMsg]);

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const notice = (t: string, color: string) =>
        appendToAssistant((parts) => [...parts, { kind: "notice", text: t, color }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          notice("Daily chat limit reached — resets at midnight UTC.", "#FFC107");
          return;
        }
        if (res.status === 503) {
          notice("The assistant is warming up — check back soon.", "#6B6B73");
          return;
        }
        if (!res.ok || !res.body) {
          notice("Something went wrong — try again shortly.", "#FF422B");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let evt: { type?: string; delta?: string; name?: string; label?: string; message?: string };
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.type === "text" && typeof evt.delta === "string") {
              const delta = evt.delta;
              appendToAssistant((parts) => {
                const last = parts[parts.length - 1];
                if (last && last.kind === "text") {
                  return [...parts.slice(0, -1), { kind: "text", text: last.text + delta }];
                }
                return [...parts, { kind: "text", text: delta }];
              });
            } else if (evt.type === "tool") {
              appendToAssistant((parts) => [
                ...parts,
                { kind: "tool", name: evt.name ?? "tool", label: evt.label ?? "Working…" },
              ]);
            } else if (evt.type === "error") {
              notice(evt.message ?? "Something went wrong — try again shortly.", "#FF422B");
            }
            // "done" → nothing to do; the read loop ends when the stream closes.
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          notice("Connection dropped — try again.", "#FF422B");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, appendToAssistant]
  );

  const closePanel = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // non-fatal
    }
  }, []);

  const remaining = MAX_INPUT - input.length;

  return (
    <>
      <style>{`@keyframes basiliskChatPulse { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }`}</style>

      {/* Launcher */}
      <button
        type="button"
        className="bk-chat-launcher"
        aria-label={open ? "Close Ask Basilisk" : "Ask Basilisk"}
        onClick={() => (open ? closePanel() : setOpen(true))}
        onMouseEnter={() => setHoverLauncher(true)}
        onMouseLeave={() => setHoverLauncher(false)}
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          background: "#20EB7A",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 24px rgba(32, 235, 122, 0.25), 0 2px 8px rgba(0, 0, 0, 0.5)",
          transform: hoverLauncher ? "scale(1.06)" : "scale(1)",
          transition: "transform 120ms ease, background 120ms ease",
          zIndex: 1001,
        }}
      >
        {open ? <CloseIcon /> : <ChatBubbleIcon />}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Ask Basilisk"
          style={{
            position: "fixed",
            right: "24px",
            bottom: "88px",
            width: "min(400px, calc(100vw - 32px))",
            height: "min(560px, 70vh)",
            background: "#0A0A0B",
            border: "1px solid #24242C",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #1A1A20",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#20EB7A",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#FFFFFF",
              }}
            >
              Ask Basilisk
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.8px",
                color: "#20EB7A",
                background: "rgba(32, 235, 122, 0.12)",
                border: "1px solid rgba(32, 235, 122, 0.25)",
                borderRadius: "4px",
                padding: "1px 6px",
              }}
            >
              BETA
            </span>
            <span style={{ fontSize: "11px", color: "#6B6B73", marginLeft: "2px" }}>
              AI analyst on live data
            </span>
            <button
              type="button"
              aria-label="Clear conversation"
              title="Clear conversation"
              onClick={clearChat}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <TrashIcon />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: "auto", padding: "14px", minHeight: 0 }}
          >
            {messages.length === 0 && (
              <div style={{ paddingTop: "8px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#6B6B73",
                    marginBottom: "10px",
                  }}
                >
                  Try asking
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      style={{
                        textAlign: "left",
                        fontSize: "12px",
                        color: "#9898A1",
                        background: "#111112",
                        border: "1px solid #24242C",
                        borderRadius: "8px",
                        padding: "9px 12px",
                        cursor: "pointer",
                      }}
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
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    borderRadius: "8px",
                    padding: "8px 11px",
                    fontSize: "13px",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    ...(m.role === "user"
                      ? {
                          background: "rgba(32, 235, 122, 0.12)",
                          border: "1px solid rgba(32, 235, 122, 0.2)",
                          color: "#FFFFFF",
                        }
                      : {
                          background: "#111112",
                          border: "1px solid #1A1A20",
                          color: "#FFFFFF",
                        }),
                  }}
                >
                  {m.parts.map((p, j) => {
                    if (p.kind === "text") {
                      return <span key={j}>{renderInline(p.text)}</span>;
                    }
                    if (p.kind === "tool") {
                      return (
                        <span
                          key={j}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                            fontSize: "11px",
                            color: "#9898A1",
                            background: "#1A1A1D",
                            border: "1px solid #24242C",
                            borderRadius: "999px",
                            padding: "2px 9px",
                            margin: "3px 4px 3px 0",
                            verticalAlign: "middle",
                          }}
                        >
                          <BoltIcon />
                          {p.label}
                        </span>
                      );
                    }
                    return (
                      <span key={j} style={{ display: "block", fontSize: "12px", color: p.color }}>
                        {p.text}
                      </span>
                    );
                  })}
                  {m.role === "assistant" &&
                    streaming &&
                    i === messages.length - 1 && (
                      <span
                        style={{
                          display: "inline-flex",
                          gap: "3px",
                          marginLeft: m.parts.length > 0 ? "6px" : 0,
                          verticalAlign: "middle",
                        }}
                        aria-label="Thinking"
                      >
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              background: "#20EB7A",
                              animation: `basiliskChatPulse 1.1s ease-in-out ${d * 0.18}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div style={{ borderTop: "1px solid #1A1A20", padding: "10px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <textarea
                ref={textareaRef}
                value={input}
                disabled={streaming}
                maxLength={MAX_INPUT}
                rows={1}
                placeholder="Ask about tokens, wallets, the market…"
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 72)}px`; // ~3 rows
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "#111112",
                  border: "1px solid #24242C",
                  borderRadius: "8px",
                  padding: "9px 11px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "#FFFFFF",
                  outline: "none",
                  lineHeight: 1.4,
                  maxHeight: "72px",
                  opacity: streaming ? 0.6 : 1,
                }}
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={() => void send(input)}
                disabled={streaming || input.trim().length === 0}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "#20EB7A",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: streaming || input.trim().length === 0 ? "default" : "pointer",
                  opacity: streaming || input.trim().length === 0 ? 0.45 : 1,
                  flexShrink: 0,
                }}
              >
                <SendIcon />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "7px",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "10px", color: "#6B6B73", lineHeight: 1.4 }}>
                Live Basilisk data · AI answers — verify before trading · Not financial advice
              </span>
              {remaining <= 200 && (
                <span
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    fontSize: "10px",
                    color: remaining <= 40 ? "#FFC107" : "#6B6B73",
                    flexShrink: 0,
                  }}
                >
                  {remaining}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
