"use client";

/**
 * Token discussion thread — wallet-signed comments.
 *
 * Comments are authenticated by CIP-30 signData (no accounts, no emails):
 * the stake address is the identity. Bodies render as PLAIN TEXT only —
 * React escaping + whiteSpace: pre-wrap; never HTML, never links.
 *
 * Contract: GET/POST /api/v1/community/comments/:unit (src/lib/community.ts).
 * Limits: 500 chars/comment, 10 comments per stake per UTC day.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useWallet } from "@/lib/wallet-context";

const MAX_LEN = 500;
const POLL_MS = 30_000;

interface CommentRow {
  id: number;
  stakeAddress: string;
  stakeShort: string;
  body: string;
  createdAt: string;
}

interface CommentsResponse {
  unit?: string;
  count?: number;
  comments?: CommentRow[];
}

interface PostResponse {
  ok?: boolean;
  comment?: CommentRow;
  error?: string;
  hint?: string;
}

/** "just now" / "4m ago" / "2h ago" / "3d ago" / date. */
function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "#6B6B73",
  fontWeight: 700,
};

const stakeChipStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "#9898A1",
  background: "var(--color-bg-hover)",
  border: "1px solid #24242C",
  borderRadius: 4,
  padding: "2px 7px",
};

export default function Discussion({ unit, symbol }: { unit: string; symbol: string }) {
  const normalizedUnit = unit.toLowerCase();
  const { status, connect, signPayload } = useWallet();

  const [comments, setComments] = useState<CommentRow[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const unitRef = useRef(normalizedUnit);
  unitRef.current = normalizedUnit;

  const load = useCallback(async () => {
    const target = unitRef.current;
    try {
      const res = await fetch(`/api/v1/community/comments/${encodeURIComponent(target)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CommentsResponse;
      if (unitRef.current !== target) return; // unit changed mid-flight
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setLoadError(false);
    } catch {
      if (unitRef.current !== target) return;
      setLoadError(true);
      setComments((prev) => prev ?? []); // keep stale list if we had one
    }
  }, []);

  // Initial load + 30s poll while the tab is visible.
  useEffect(() => {
    setComments(null);
    setLoadError(false);
    void load();

    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [normalizedUnit, load]);

  const handlePost = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPostError(null);
    setPosting(true);
    try {
      const signed = await signPayload({
        action: "comment",
        unit: normalizedUnit,
        body,
        ts: new Date().toISOString(),
      });
      const res = await fetch(`/api/v1/community/comments/${encodeURIComponent(normalizedUnit)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signed.payloadJson,
          signature: signed.signature,
          key: signed.key,
          rewardAddressHex: signed.rewardAddressHex,
        }),
      });

      let data: PostResponse = {};
      try {
        data = (await res.json()) as PostResponse;
      } catch {
        // non-JSON body
      }

      if (res.status === 201 && data.comment) {
        const posted = data.comment;
        // Optimistic prepend (list is newest-first); dedupe on poll overlap.
        setComments((prev) => [posted, ...(prev ?? []).filter((c) => c.id !== posted.id)]);
        setDraft("");
        return;
      }

      if (res.status === 503) {
        setPostError("Community features are warming up — check back soon.");
      } else if (res.status === 429) {
        setPostError(data.hint ?? "Daily comment limit reached — each wallet gets 10 per UTC day.");
      } else {
        setPostError(data.error ?? "Could not post the comment — try again.");
      }
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Could not post the comment — try again.");
    } finally {
      setPosting(false);
    }
  }, [draft, posting, signPayload, normalizedUnit]);

  const overLimit = draft.length > MAX_LEN;
  const count = comments?.length ?? null;

  return (
    <section
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid #24242C",
        borderRadius: 8,
        padding: 18,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span style={labelStyle}>Discussion</span>
        {count !== null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9898A1" }}>
            {count}
          </span>
        )}
      </div>

      {/* Composer */}
      {status === "connected" ? (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            placeholder={`What do you think about $${symbol}?`}
            rows={3}
            maxLength={MAX_LEN}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 68,
              background: "var(--color-bg-secondary)",
              border: "1px solid #24242C",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.5,
              color: "#FFFFFF",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: overLimit ? "#FF422B" : "#6B6B73",
              }}
            >
              {draft.length}/{MAX_LEN}
            </span>
            <button
              onClick={() => void handlePost()}
              disabled={posting || !draft.trim()}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 16px",
                borderRadius: 6,
                background: "#20EB7A",
                color: "#001A0E",
                border: "none",
                cursor: posting || !draft.trim() ? "default" : "pointer",
                opacity: posting || !draft.trim() ? 0.55 : 1,
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
          {postError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#FFC107" }}>{postError}</div>
          )}
        </div>
      ) : (
        <button
          onClick={() => void connect()}
          disabled={status === "connecting"}
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "14px 12px",
            borderRadius: 6,
            background: "transparent",
            border: "1px dashed #2F2F38",
            color: "#9898A1",
            fontSize: 13,
            cursor: status === "connecting" ? "wait" : "pointer",
            textAlign: "center",
          }}
        >
          {status === "connecting" ? "Connecting…" : "Connect a wallet to join the discussion"}
        </button>
      )}

      {/* List */}
      {comments === null ? (
        // Loading skeleton
        <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ width: 130, height: 12, borderRadius: 4, background: "var(--color-bg-hover)" }} />
              <div
                style={{
                  width: i === 1 ? "62%" : "84%",
                  height: 12,
                  borderRadius: 4,
                  background: "var(--color-bg-hover)",
                }}
              />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ padding: "20px 0 8px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#9898A1" }}>
            Be the first to talk about ${symbol}
          </div>
          {loadError && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#6B6B73" }}>
              Comments are delayed — retrying shortly.
            </div>
          )}
        </div>
      ) : (
        <>
          {loadError && (
            <div style={{ marginBottom: 10, fontSize: 12, color: "#FFC107" }}>
              Comments are delayed — showing the last loaded thread.
            </div>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {comments.map((c) => (
              <li
                key={c.id}
                style={{ borderTop: "1px solid #1A1A20", paddingTop: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={stakeChipStyle}>{c.stakeShort}</span>
                  <span style={{ fontSize: 11, color: "#6B6B73" }}>{relativeTime(c.createdAt)}</span>
                </div>
                {/* Plain text only: React escapes; pre-wrap preserves newlines. */}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "#FFFFFF",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
