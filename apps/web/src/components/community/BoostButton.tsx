"use client";

/**
 * Community boost button — free, democratic boosts.
 *
 * One CIP-30 wallet signature = one boost per stake address per UTC day.
 * No payment, no ranking auction — unlike TapTools' 300-ADA paid Boosts,
 * visibility here is earned one wallet signature at a time.
 *
 * Contract: GET/POST /api/v1/community/boosts (see src/lib/community.ts).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useWallet } from "@/lib/wallet-context";

interface BoostSummaryRow {
  unit: string;
  boosts24h: number;
  boosts7d: number;
  boostsToday: number;
}

interface BoostSummaryResponse {
  summaries?: BoostSummaryRow[];
}

interface ApiErrorBody {
  error?: string;
  hint?: string;
}

/** Today's UTC calendar day, "YYYY-MM-DD" — must match the server contract. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BoostButton({ unit, symbol }: { unit: string; symbol: string }) {
  const normalizedUnit = unit.toLowerCase();
  const { status, connect, signPayload, rewardAddressHex } = useWallet();

  const [countToday, setCountToday] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const [showTip, setShowTip] = useState(false);
  // Synchronous re-entrancy guard: setBusy is async, so rapid double-clicks
  // (or click during the connect modal) could otherwise fire twice.
  const inFlightRef = useRef(false);

  const refreshCount = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/v1/community/boosts?units=${encodeURIComponent(normalizedUnit)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BoostSummaryResponse;
      const row = data.summaries?.find((s) => s.unit === normalizedUnit);
      setCountToday(row?.boostsToday ?? 0);
    } catch {
      setCountToday((c) => c); // keep whatever we had
    }
  }, [normalizedUnit]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    (async () => {
      try {
        const res = await fetch(`/api/v1/community/boosts?units=${encodeURIComponent(normalizedUnit)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BoostSummaryResponse;
        const row = data.summaries?.find((s) => s.unit === normalizedUnit);
        if (!cancelled) setCountToday(row?.boostsToday ?? 0);
      } catch {
        if (!cancelled) setCountToday(null); // count delayed — button still works
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedUnit]);

  // A different wallet identity gets its own boost state.
  useEffect(() => {
    setBoosted(false);
    setNote(null);
  }, [rewardAddressHex]);

  const handleBoost = useCallback(async () => {
    if (inFlightRef.current || boosted) return;
    inFlightRef.current = true;
    setBusy(true);
    setNote(null);

    try {
      // Connect first when needed; the provider handles the picker modal.
      if (status !== "connected") {
        const snapshot = await connect();
        if (!snapshot) return; // user dismissed picker / connect failed
      }
      const signed = await signPayload({ action: "boost", unit: normalizedUnit, day: todayUtc() });
      const res = await fetch("/api/v1/community/boosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signed.payloadJson,
          signature: signed.signature,
          key: signed.key,
          rewardAddressHex: signed.rewardAddressHex,
        }),
      });

      if (res.status === 201) {
        setBoosted(true);
        setCountToday((c) => (c ?? 0) + 1); // optimistic; refresh converges
        setNote({ tone: "success", text: "1 free boost per wallet per day" });
        void refreshCount();
        return;
      }

      let body: ApiErrorBody = {};
      try {
        body = (await res.json()) as ApiErrorBody;
      } catch {
        // non-JSON error body
      }

      if (res.status === 409) {
        setBoosted(true);
        setNote({ tone: "warning", text: "You already used today's boost" });
        void refreshCount();
        return;
      }
      if (res.status === 503) {
        setNote({ tone: "error", text: "Community features are warming up — try again soon." });
        return;
      }
      setNote({ tone: "error", text: body.error ?? "Boost failed — try again." });
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof Error ? err.message : "Boost failed — try again.",
      });
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [boosted, status, connect, signPayload, normalizedUnit, refreshCount]);

  const isFilled = boosted && note?.tone !== "warning";

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={() => void handleBoost()}
        disabled={busy}
        aria-label={`Boost ${symbol} — free community boost`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 14px",
          borderRadius: 6,
          cursor: busy ? "wait" : boosted ? "default" : "pointer",
          background: isFilled ? "#20EB7A" : "var(--color-bg-elevated)",
          color: isFilled ? "#001A0E" : "#FFFFFF",
          border: isFilled ? "1px solid #20EB7A" : "1px solid #24242C",
          opacity: busy ? 0.7 : 1,
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        {/* Bolt icon — stroke only */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>

        {isFilled ? "Boosted" : busy ? "Boosting…" : "Boost"}

        {isFilled && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        {/* Today's count — mono numerics */}
        {loadingCount ? (
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 18,
              height: 12,
              borderRadius: 3,
              background: isFilled ? "rgba(0,26,14,0.2)" : "var(--color-bg-hover)",
            }}
          />
        ) : countToday !== null ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 500,
              color: isFilled ? "#001A0E" : "#9898A1",
            }}
          >
            {countToday}
          </span>
        ) : null}
      </button>

      {note && (
        <span
          style={{
            fontSize: 11,
            color:
              note.tone === "success" ? "#20EB7A" : note.tone === "warning" ? "#FFC107" : "#FF422B",
          }}
        >
          {note.text}
        </span>
      )}

      {showTip && !busy && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 230,
            background: "var(--color-bg-elevated)",
            border: "1px solid #24242C",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#9898A1",
            zIndex: 120,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "#FFFFFF", fontWeight: 600 }}>
            Free community boosts — never pay-to-play.
          </span>{" "}
          One wallet signature = one boost per UTC day. No 300-ADA fees, no ranking auctions.
        </div>
      )}
    </div>
  );
}
