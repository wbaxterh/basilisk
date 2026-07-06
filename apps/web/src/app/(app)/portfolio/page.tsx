"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import EmptyState from "../../../components/EmptyState";
import type { WalletResponse } from "@/lib/dex-data";

const MONO = "var(--font-mono)";
const UNPRICED_TIP = "no DEX pair indexed — coverage: SundaeSwap + WingRiders";
const DONUT_COLORS = [
  "var(--color-brand)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-brand-dim)",
  "#9898A1",
  "#6B6B73",
];

interface Row {
  key: string;
  ticker: string | null;
  name: string;
  amount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  isAda: boolean;
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioContent />
    </Suspense>
  );
}

function PortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const w = searchParams.get("w") ?? "";

  const [input, setInput] = useState(w);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!w) {
      setWallet(null);
      setError(null);
      setLoading(false);
      return;
    }
    setInput(w);
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/wallet/${encodeURIComponent(w)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setWallet(null);
          setError(friendlyError(w, res.status, body));
        } else {
          setWallet(body as WalletResponse);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWallet(null);
        setError("Wallet data is delayed right now — try again in a moment.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [w]);

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    if (!q.startsWith("$") && !q.startsWith("addr1") && !q.startsWith("stake1")) {
      setError("Not a valid Cardano address — enter a $handle, addr1..., or stake1... value.");
      return;
    }
    setError(null);
    router.push(`/portfolio?w=${encodeURIComponent(q)}`);
  };

  const rows = useMemo<Row[]>(() => {
    if (!wallet) return [];
    const adaPrice =
      wallet.adaBalance > 0 && wallet.adaValueUsd != null
        ? wallet.adaValueUsd / wallet.adaBalance
        : null;
    const ada: Row = {
      key: "lovelace",
      ticker: "ADA",
      name: "Cardano",
      amount: wallet.adaBalance,
      priceUsd: adaPrice,
      valueUsd: wallet.adaValueUsd,
      isAda: true,
    };
    const rest: Row[] = wallet.holdings.map((h) => ({
      key: h.unit,
      ticker: h.ticker,
      name: h.name,
      amount: Number(h.quantity) / 10 ** h.decimals,
      priceUsd: h.priceUsd,
      valueUsd: h.valueUsd,
      isAda: false,
    }));
    const all = wallet.adaBalance > 0 || wallet.adaValueUsd != null ? [ada, ...rest] : rest;
    const priced = all.filter((r) => r.valueUsd != null).sort((a, b) => b.valueUsd! - a.valueUsd!);
    const unpriced = all.filter((r) => r.valueUsd == null);
    return [...priced, ...unpriced];
  }, [wallet]);

  const donut = useMemo(() => {
    const priced = rows.filter((r) => (r.valueUsd ?? 0) > 0);
    if (priced.length < 2) return null;
    const top = priced.slice(0, 5);
    const restValue = priced.slice(5).reduce((s, r) => s + (r.valueUsd ?? 0), 0);
    const segs = top.map((r, i) => ({
      label: r.ticker ?? r.name,
      value: r.valueUsd!,
      color: DONUT_COLORS[i],
    }));
    if (restValue > 0) segs.push({ label: "Other", value: restValue, color: DONUT_COLORS[5] });
    const total = segs.reduce((s, x) => s + x.value, 0);
    return total > 0 ? { segs, total } : null;
  }, [rows]);

  const isEmptyWallet =
    wallet != null && wallet.adaBalance === 0 && wallet.rewards === 0 && wallet.holdings.length === 0;

  const stakeShort = wallet?.stakeAddress ? shorten(wallet.stakeAddress) : null;
  const apiPath = w ? `/api/v1/wallet/${encodeURIComponent(w)}` : null;

  const copyStake = () => {
    if (!wallet?.stakeAddress) return;
    navigator.clipboard?.writeText(wallet.stakeAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <style>{`@keyframes bkPulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } } .bk-pulse { animation: bkPulse 1.4s ease-in-out infinite; }`}</style>

      {/* Hero search */}
      <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", padding: wallet || loading || error ? "8px 0 28px" : "48px 0 28px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Portfolio</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: "0 0 20px" }}>
          Any Cardano wallet — holdings, value, rewards, delegation.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <input
            type="text"
            placeholder="$yourhandle · addr1... · stake1..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            spellCheck={false}
            style={{
              flex: "1 1 320px",
              padding: "13px 18px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-primary)",
              fontSize: 15,
              fontFamily: MONO,
              outline: "none",
            }}
          />
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: "13px 26px",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-brand)",
              color: "#001A0E",
              fontWeight: 700,
              fontSize: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Looking up..." : "Look up"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "10px 2px 0", textAlign: "left" }}>
          $handle-native — try any Cardano wallet, no login
        </p>
      </div>

      {error && (
        <div style={{
          maxWidth: 680,
          margin: "0 auto 20px",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(255, 66, 43, 0.08)",
          border: "1px solid rgba(255, 66, 43, 0.25)",
          color: "var(--color-negative)",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && !error && !wallet && (
        <EmptyState
          title="Profile any wallet"
          description="Paste a $handle, payment address, or stake address above to see holdings, USD value, staking rewards, and delegation."
        />
      )}

      {!loading && wallet && isEmptyWallet && (
        <>
          <EmptyState
            title="Empty wallet"
            description="This wallet resolved fine, but it holds no ADA or native assets yet."
          />
          {apiPath && <ApiRow apiPath={apiPath} />}
        </>
      )}

      {!loading && wallet && !isEmptyWallet && (
        <>
          {/* Identity row: handle chip + stake address */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 12 }}>
            {wallet.input.startsWith("$") && (
              <span style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--color-brand-soft)",
                color: "var(--color-brand)",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: MONO,
              }}>
                {wallet.input}
              </span>
            )}
            {stakeShort && (
              <button
                onClick={copyStake}
                title="Copy stake address"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-tile)",
                  color: copied ? "var(--color-brand)" : "var(--color-text-secondary)",
                  fontSize: 12,
                  fontFamily: MONO,
                }}
              >
                {copied ? "copied" : stakeShort}
                <CopyIcon />
              </button>
            )}
          </div>

          {/* Summary band */}
          <div style={{
            display: "flex",
            flexWrap: "wrap" as const,
            gap: 24,
            alignItems: "center",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
            marginBottom: 16,
          }}>
            <div style={{
              flex: "1 1 380px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 20,
            }}>
              <Stat label="Total value" large>
                {wallet.totalValueUsd != null ? fmtUsd(wallet.totalValueUsd) : "—"}
              </Stat>
              <Stat label="ADA balance">{fmtAmount(wallet.adaBalance)} ₳</Stat>
              <Stat label="Rewards">{fmtAmount(wallet.rewards)} ₳</Stat>
              <Stat label="Delegated pool">{wallet.pool ? shorten(wallet.pool, 9, 4) : "—"}</Stat>
            </div>
            {donut && <AllocationDonut segs={donut.segs} total={donut.total} />}
          </div>

          {/* Holdings */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 8,
            marginBottom: 10,
          }}>
            <span style={{
              fontSize: 11,
              textTransform: "uppercase" as const,
              letterSpacing: 1.2,
              color: "var(--color-text-muted)",
              fontWeight: 600,
            }}>
              Holdings · {rows.length}
            </span>
            <span style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-tile)",
              color: "var(--color-text-muted)",
              fontSize: 11,
            }}>
              DEX data: SundaeSwap + WingRiders via DexScreener
            </span>
          </div>

          <div style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            overflowX: "auto" as const,
            marginBottom: 16,
          }}>
            <div style={{ minWidth: 640 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px, 2fr) 1fr 1fr 1fr minmax(110px, 1.2fr)",
                gap: 16,
                padding: "12px 20px",
                borderBottom: "1px solid var(--color-border)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textTransform: "uppercase" as const,
                letterSpacing: 1,
              }}>
                <span>Asset</span>
                <span style={{ textAlign: "right" }}>Balance</span>
                <span style={{ textAlign: "right" }}>Price</span>
                <span style={{ textAlign: "right" }}>Value</span>
                <span style={{ textAlign: "right" }}>% of portfolio</span>
              </div>
              {rows.map((r) => {
                const pct =
                  r.valueUsd != null && wallet.totalValueUsd != null && wallet.totalValueUsd > 0
                    ? (r.valueUsd / wallet.totalValueUsd) * 100
                    : null;
                return (
                  <div
                    key={r.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(160px, 2fr) 1fr 1fr 1fr minmax(110px, 1.2fr)",
                      gap: 16,
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--color-border-soft)",
                      fontSize: 13,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: r.isAda ? "var(--color-brand)" : "var(--color-text-primary)" }}>
                        {r.ticker ?? shorten(r.name, 8, 4)}
                      </span>
                      <span style={{
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}>
                        {r.name}
                      </span>
                    </span>
                    <span style={{ textAlign: "right", fontFamily: MONO, color: "var(--color-text-secondary)" }}>
                      {fmtAmount(r.amount)}
                    </span>
                    <span
                      style={{ textAlign: "right", fontFamily: MONO, color: r.priceUsd != null ? "var(--color-text-secondary)" : "var(--color-text-muted)" }}
                      title={r.priceUsd == null && !r.isAda ? UNPRICED_TIP : undefined}
                    >
                      {r.priceUsd != null ? fmtUsd(r.priceUsd) : "—"}
                    </span>
                    <span style={{ textAlign: "right", fontFamily: MONO, color: "var(--color-text-primary)" }}>
                      {r.valueUsd != null ? fmtUsd(r.valueUsd) : "—"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <span style={{ width: 56, height: 4, borderRadius: 2, background: "var(--color-border-soft)", overflow: "hidden" }}>
                        <span style={{
                          display: "block",
                          height: "100%",
                          width: `${Math.min(pct ?? 0, 100)}%`,
                          background: "var(--color-brand)",
                          borderRadius: 2,
                        }} />
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--color-text-muted)", minWidth: 44, textAlign: "right" }}>
                        {pct != null ? `${pct.toFixed(1)}%` : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {apiPath && <ApiRow apiPath={apiPath} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Stat({ label, large, children }: { label: string; large?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        textTransform: "uppercase" as const,
        letterSpacing: 1.2,
        color: "var(--color-text-muted)",
        marginBottom: 6,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ fontSize: large ? 26 : 17, fontWeight: 700, fontFamily: MONO }}>{children}</div>
    </div>
  );
}

function AllocationDonut({ segs, total }: { segs: Array<{ label: string; value: number; color: string }>; total: number }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={104} height={104} viewBox="0 0 104 104" aria-hidden="true">
        <g transform="rotate(-90 52 52)">
          {segs.map((s) => {
            const frac = s.value / total;
            const dash = Math.max(frac * C - 1.5, 0.5);
            const el = (
              <circle
                key={s.label}
                cx={52}
                cy={52}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={11}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += frac * C;
            return el;
          })}
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segs.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-secondary)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {s.label}
            </span>
            <span style={{ fontFamily: MONO, color: "var(--color-text-muted)" }}>
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiRow({ apiPath }: { apiPath: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap" as const,
      padding: "12px 16px",
      background: "var(--color-bg-tile)",
      border: "1px solid var(--color-border-soft)",
      borderRadius: "var(--radius-lg)",
      fontFamily: MONO,
      fontSize: 12,
    }}>
      <span style={{ color: "var(--color-text-muted)" }}>This wallet as JSON:</span>
      <a href={apiPath} target="_blank" rel="noreferrer" style={{ color: "var(--color-brand)", wordBreak: "break-all" as const }}>
        GET {apiPath}
      </a>
      <span style={{ color: "var(--color-text-muted)" }}>·</span>
      <Link href="/agents" style={{ color: "var(--color-text-secondary)" }}>
        agents profile wallets with get_wallet →
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        marginBottom: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 20,
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="bk-pulse" style={{ width: 72, height: 10, background: "var(--color-bg-hover)", borderRadius: 4, marginBottom: 10 }} />
            <div className="bk-pulse" style={{ width: 110, height: 22, background: "var(--color-bg-hover)", borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "14px 20px", borderBottom: i < 4 ? "1px solid var(--color-border-soft)" : "none" }}>
            <div className="bk-pulse" style={{ width: "26%", height: 14, background: "var(--color-bg-hover)", borderRadius: 4 }} />
            <div className="bk-pulse" style={{ width: "16%", height: 14, background: "var(--color-bg-hover)", borderRadius: 4 }} />
            <div className="bk-pulse" style={{ width: "14%", height: 14, background: "var(--color-bg-hover)", borderRadius: 4 }} />
            <div className="bk-pulse" style={{ width: "18%", height: 14, background: "var(--color-bg-hover)", borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function friendlyError(
  input: string,
  status: number,
  body: { error?: string; hint?: string } | null
): string {
  if (input.startsWith("$") && (status === 404 || status === 400)) {
    return `Couldn't resolve that handle (${input}) — check the spelling, or paste an addr1/stake1 address.`;
  }
  if (status === 400) {
    return "Not a valid Cardano address — enter a $handle, addr1..., or stake1... value.";
  }
  if (status === 404) {
    return body?.error ? `${body.error}.` : "No wallet found for that address.";
  }
  return "Wallet data is delayed right now — try again in a moment.";
}

function shorten(s: string, head = 12, tail = 6): string {
  return s.length > head + tail + 3 ? `${s.slice(0, head)}...${s.slice(-tail)}` : s;
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1) {
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${v.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
}

function fmtAmount(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v === 0) return "0";
  return v.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}
