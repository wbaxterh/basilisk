"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TokenDetail, PairRow, TokenLink } from "@/lib/dex-data";
import {
  fetchTokenDetail as fetchLegacyDetail,
  fmtUsd,
  fmtPct,
  fmtCount,
  type TokenDetail as LegacyTokenDetail,
} from "@/lib/public-data";
import TokenChart from "@/components/TokenChart";
import BoostButton from "@/components/community/BoostButton";
import Discussion from "@/components/community/Discussion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COVERAGE_TEXT = "DEX data: SundaeSwap + WingRiders via DexScreener";

/** policyId (56 hex) + optional assetNameHex → the new canonical param. */
function isAssetUnit(s: string): boolean {
  return /^[0-9a-fA-F]{56,}$/.test(s);
}

function shortHex(s: string, head = 8, tail = 6): string {
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

/** Token prices span $2,000 to $0.0000009 — pick digits by magnitude. */
function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(3)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n <= 0) return `$${n.toFixed(2)}`;
  const digits = Math.min(12, 2 - Math.floor(Math.log10(n)));
  return `$${n.toFixed(digits)}`;
}

const DEX_LABELS: Record<string, string> = {
  sundaeswap: "SundaeSwap",
  wingriders: "WingRiders",
  minswap: "Minswap",
  muesliswap: "MuesliSwap",
};

function dexLabel(id: string): string {
  return DEX_LABELS[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Buy/sell pressure — h1/h6 txns come straight from DexScreener client-side
// (the /api/v1 detail only aggregates h24). Graceful null on failure.
// ---------------------------------------------------------------------------

interface TfTxns {
  buys: number;
  sells: number;
}

interface Pressure {
  h1: TfTxns;
  h6: TfTxns;
  h24: TfTxns;
}

async function fetchPressure(unit: string): Promise<Pressure | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/cardano/${unit}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const pairs = (await res.json()) as Array<{
      chainId: string;
      baseToken?: { address?: string };
      txns?: Partial<Record<"h1" | "h6" | "h24", { buys: number; sells: number }>>;
    }>;
    const out: Pressure = {
      h1: { buys: 0, sells: 0 },
      h6: { buys: 0, sells: 0 },
      h24: { buys: 0, sells: 0 },
    };
    let any = false;
    for (const p of pairs) {
      if (p.chainId !== "cardano") continue;
      // DexScreener txns count buys/sells of the BASE token. Quote-side
      // pairs (e.g. NIGHT/USDM viewed from USDM) would invert the signal.
      if (p.baseToken?.address?.toLowerCase() !== unit) continue;
      any = true;
      for (const tf of ["h1", "h6", "h24"] as const) {
        out[tf].buys += p.txns?.[tf]?.buys ?? 0;
        out[tf].sells += p.txns?.[tf]?.sells ?? 0;
      }
    }
    return any ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stroke SVG icons (16-18px, strokeWidth 1.5-1.8, never emoji)
// ---------------------------------------------------------------------------

function SvgBase({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.5 13.5 0 014 9 13.5 13.5 0 01-4 9 13.5 13.5 0 01-4-9 13.5 13.5 0 014-9z" />
    </SvgBase>
  );
}

function XIcon({ size = 13 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M4 4l16 16" />
      <path d="M20 4L4 20" />
    </SvgBase>
  );
}

function LinkIcon({ size = 14 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </SvgBase>
  );
}

function ExternalIcon({ size = 12 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </SvgBase>
  );
}

function CopyIcon({ size = 13 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </SvgBase>
  );
}

function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M20 6L9 17l-5-5" />
    </SvgBase>
  );
}

function PulseIcon({ size = 18 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </SvgBase>
  );
}

function TerminalIcon({ size = 16 }: { size?: number }) {
  return (
    <SvgBase size={size}>
      <path d="M4 17l6-5-6-5" />
      <path d="M12 19h8" />
    </SvgBase>
  );
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  title,
  sub,
  children,
  footer,
}: {
  title?: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      {title && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>
          {sub && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{sub}</div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {footer && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--color-border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

function CoverageChip({ text }: { text?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid var(--color-border-soft)",
        background: "var(--color-bg-secondary)",
        fontSize: 10.5,
        letterSpacing: 0.3,
        color: "var(--color-text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: "var(--color-brand)",
          flexShrink: 0,
        }}
      />
      {text ?? COVERAGE_TEXT}
    </span>
  );
}

function ChangePill({ label, value }: { label: string; value: number | null }) {
  const none = value == null;
  const up = (value ?? 0) >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        background: none
          ? "var(--color-bg-secondary)"
          : up
          ? "rgba(32,235,122,0.12)"
          : "rgba(255,66,43,0.12)",
        color: none
          ? "var(--color-text-muted)"
          : up
          ? "var(--color-positive)"
          : "var(--color-negative)",
        border: "1px solid var(--color-border-soft)",
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.8,
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {label}
      </span>
      {none ? "—" : fmtPct(value as number)}
    </span>
  );
}

/** Click-to-copy identifier chip with check-mark feedback. */
function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — leave silently
    }
  };
  return (
    <button
      onClick={onCopy}
      title={`Copy ${value}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: "var(--color-bg-secondary)",
        border: `1px solid ${copied ? "var(--color-brand-dim)" : "var(--color-border)"}`,
        cursor: "pointer",
        transition: "border-color 120ms",
        color: "var(--color-text-secondary)",
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{shortHex(value)}</span>
      <span style={{ color: copied ? "var(--color-brand)" : "var(--color-text-muted)", display: "inline-flex" }}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}

/** Defense in depth: upstream token metadata is attacker-controlled, so
 * only ever emit http(s) hrefs (the data layer also sanitizes). */
function httpUrlOrNull(u: string): string | null {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}

function LinkChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const safe = httpUrlOrNull(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 6,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--color-text-secondary)",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--color-text-muted)" }}>{icon}</span>
      {children}
    </a>
  );
}

function Sk({ w, h = 12, mb = 0 }: { w: number | string; h?: number; mb?: number }) {
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        marginBottom: mb,
        background: "var(--color-bg-hover)",
        borderRadius: 4,
        opacity: 0.55,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page entry — route param is now policyId+assetNameHex; legacy CoinGecko ids
// (lowercase letters/dashes) fall back to the old CoinGecko view so old links
// keep resolving.
// ---------------------------------------------------------------------------

export default function TokenDetailPage() {
  const params = useParams<{ asset: string }>();
  const raw = decodeURIComponent(params.asset ?? "");
  if (isAssetUnit(raw)) return <AssetTokenPage unit={raw.toLowerCase()} />;
  return <LegacyTokenPage id={raw} />;
}

// ---------------------------------------------------------------------------
// New policy-ID page
// ---------------------------------------------------------------------------

type Status = "loading" | "ready" | "notfound" | "error";

function AssetTokenPage({ unit }: { unit: string }) {
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [pressure, setPressure] = useState<Pressure | null>(null);
  const [pressureLoading, setPressureLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setDetail(null);
    setPressure(null);
    setPressureLoading(true);

    fetch(`/api/v1/tokens/${unit}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus("notfound");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = (await res.json()) as TokenDetail;
        if (cancelled) return;
        setDetail(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    fetchPressure(unit).then((p) => {
      if (cancelled) return;
      setPressure(p);
      setPressureLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [unit, attempt]);

  if (status === "loading") return <PageSkeleton unit={unit} />;
  if (status === "notfound") return <NotFound id={unit} />;
  if (status === "error" || !detail) {
    return (
      <div style={{ padding: "48px 0", maxWidth: 520 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Market data delayed</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          Upstream sources (DexScreener / Koios) didn&apos;t answer in time for{" "}
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            {shortHex(unit)}
          </code>
          . Nothing is broken on your end.
        </p>
        <button
          onClick={() => setAttempt((a) => a + 1)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            background: "var(--color-brand)",
            color: "#001A0E",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb symbol={detail.symbol} />
      <TokenHeader detail={detail} />
      <HeroBand detail={detail} />

      <div style={{ marginBottom: 14 }}>
        <TokenChart asset={unit} height={440} />
        <IdentityChips detail={detail} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <PressureCard
          pressure={pressure}
          loading={pressureLoading}
          fallback24h={{ buys: detail.buys24h, sells: detail.sells24h }}
        />
        <OnChainCard detail={detail} />
      </div>

      <PairsTable pairs={detail.pairs} coverage={detail.coverage} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <LiveTradesCard />
        <AgentCard unit={unit} />
      </div>

      <div style={{ marginTop: 14 }}>
        <Discussion unit={unit} symbol={detail.symbol} />
      </div>
    </div>
  );
}

function Breadcrumb({ symbol }: { symbol: string }) {
  return (
    <nav style={{ marginBottom: 18, fontSize: 12, color: "var(--color-text-muted)" }}>
      <Link href="/screener" style={{ color: "var(--color-text-secondary)" }}>
        Screener
      </Link>
      <span style={{ margin: "0 8px" }}>/</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{symbol}</span>
    </nav>
  );
}

/** Header avatar — served by /api/v1/tokens/{unit}/logo (which falls back
 * upstream itself); on load error try detail.imageUrl, then the monogram. */
function HeaderLogo({ detail }: { detail: TokenDetail }) {
  // 0 = logo route, 1 = raw imageUrl, 2 = monogram
  const [stage, setStage] = useState(0);
  const src =
    stage === 0 ? `/api/v1/tokens/${detail.address}/logo` : stage === 1 ? detail.imageUrl : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={detail.name}
        width={46}
        height={46}
        onError={() => setStage((s) => (s === 0 && detail.imageUrl ? 1 : 2))}
        style={{
          borderRadius: 10,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 10,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 800,
        fontFamily: "var(--font-mono)",
        color: "var(--color-text-muted)",
      }}
    >
      {detail.symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TokenHeader({ detail }: { detail: TokenDetail }) {
  return (
    <header style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <HeaderLogo detail={detail} />

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>{detail.name}</h1>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
              }}
            >
              {detail.symbol}
            </span>
            {detail.dexIds.map((d) => (
              <span
                key={d}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 4,
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {dexLabel(d)}
              </span>
            ))}
          </div>
          {detail.description && (
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text-secondary)",
                marginTop: 6,
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              {detail.description}
            </p>
          )}
        </div>

        <div style={{ marginLeft: "auto" }}>
          <BoostButton unit={detail.address} symbol={detail.symbol} />
        </div>
      </div>
    </header>
  );
}

/** Policy / fingerprint / website / social chips — rendered below the chart
 * so the chart itself lands above the fold. */
function IdentityChips({ detail }: { detail: TokenDetail }) {
  const socials = detail.socials ?? [];
  const websites = detail.websites ?? [];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <CopyChip label="Policy" value={detail.policyId} />
      {detail.fingerprint && <CopyChip label="Fingerprint" value={detail.fingerprint} />}
      {websites.map((w: TokenLink, i: number) => (
        <LinkChip key={`w${i}`} href={w.url} icon={<GlobeIcon />}>
          {w.label ?? hostnameOf(w.url)}
        </LinkChip>
      ))}
      {socials.map((s: TokenLink, i: number) => {
        const isX = (s.type ?? "").toLowerCase() === "twitter" || (s.type ?? "").toLowerCase() === "x";
        return (
          <LinkChip key={`s${i}`} href={s.url} icon={isX ? <XIcon /> : <LinkIcon />}>
            {isX ? "X" : s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : hostnameOf(s.url)}
          </LinkChip>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero stat band — the TapTools five
// ---------------------------------------------------------------------------

function HeroBand({ detail }: { detail: TokenDetail }) {
  return (
    <section
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "18px 20px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 18,
            alignItems: "start",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 170 }}>
            <FieldLabel>Price</FieldLabel>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              {fmtPrice(detail.priceUsd)}
            </span>
          </div>
          <BandStat label="24H Volume" value={fmtUsd(detail.volume24h, 2)} />
          <BandStat label="Liquidity" value={fmtUsd(detail.liquidityUsd, 2)} />
          <BandStat label="Market Cap" value={detail.marketCap != null ? fmtUsd(detail.marketCap, 2) : "—"} />
          <BandStat label="FDV" value={detail.fdv != null ? fmtUsd(detail.fdv, 2) : "—"} />
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ChangePill label="1H" value={detail.change1h} />
            <ChangePill label="6H" value={detail.change6h} />
            <ChangePill label="24H" value={detail.change24h} />
          </div>
          <CoverageChip text={`DEX data: ${detail.coverage}`} />
        </div>
      </div>
    </section>
  );
}

function BandStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buy / Sell pressure — signature card
// ---------------------------------------------------------------------------

function PressureCard({
  pressure,
  loading,
  fallback24h,
}: {
  pressure: Pressure | null;
  loading: boolean;
  fallback24h: TfTxns;
}) {
  const rows: Array<{ label: string; data: TfTxns | null }> = pressure
    ? [
        { label: "1H", data: pressure.h1 },
        { label: "6H", data: pressure.h6 },
        { label: "24H", data: pressure.h24 },
      ]
    : [
        { label: "1H", data: null },
        { label: "6H", data: null },
        { label: "24H", data: fallback24h },
      ];

  return (
    <Card
      title="Buy / Sell Pressure"
      sub="Transaction counts across covered pairs"
      footer={<CoverageChip />}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "34px 78px 1fr 78px",
          gap: 10,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--color-positive)",
            textAlign: "right",
          }}
        >
          Buys
        </span>
        <span />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--color-negative)",
          }}
        >
          Sells
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map((r) => (
          <PressureRow key={r.label} label={r.label} data={r.data} loading={loading} />
        ))}
      </div>
    </Card>
  );
}

function PressureRow({
  label,
  data,
  loading,
}: {
  label: string;
  data: TfTxns | null;
  loading: boolean;
}) {
  const total = data ? data.buys + data.sells : 0;
  const buyPct = data && total > 0 ? (data.buys / total) * 100 : 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34px 78px 1fr 78px",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>

      {data == null ? (
        <>
          <span style={{ textAlign: "right", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
            —
          </span>
          <div
            style={{
              height: 10,
              borderRadius: 6,
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 9, letterSpacing: 0.6, color: "var(--color-text-muted)" }}>
              {loading ? "" : "data delayed"}
            </span>
          </div>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>—</span>
        </>
      ) : (
        <>
          <span
            style={{
              textAlign: "right",
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--color-positive)",
            }}
          >
            {fmtCount(data.buys)}
          </span>
          {total === 0 ? (
            <div
              style={{
                height: 10,
                borderRadius: 6,
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-soft)",
              }}
            />
          ) : (
            <div
              style={{ display: "flex", gap: 3, height: 10, alignItems: "stretch" }}
              title={`${buyPct.toFixed(1)}% buys · ${(100 - buyPct).toFixed(1)}% sells`}
            >
              <div
                style={{
                  width: `${buyPct}%`,
                  minWidth: data.buys > 0 ? 6 : 0,
                  borderRadius: 5,
                  background: "linear-gradient(90deg, rgba(32,235,122,0.55), #20EB7A)",
                  transition: "width 300ms ease",
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: data.sells > 0 ? 6 : 0,
                  borderRadius: 5,
                  background: "linear-gradient(90deg, #FF422B, rgba(255,66,43,0.55))",
                  transition: "width 300ms ease",
                }}
              />
            </div>
          )}
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--color-negative)",
            }}
          >
            {fmtCount(data.sells)}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-chain card (Koios)
// ---------------------------------------------------------------------------

function OnChainCard({ detail }: { detail: TokenDetail }) {
  const decimals = detail.decimals ?? 0;
  const supply =
    detail.totalSupply != null
      ? (Number(detail.totalSupply) / 10 ** decimals).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })
      : null;
  const minted =
    detail.creationTime != null
      ? new Date(detail.creationTime * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <Card
      title="On-chain"
      sub="Ledger facts via Koios"
      footer={
        <span style={{ fontSize: 10.5, color: "var(--color-text-muted)", letterSpacing: 0.3 }}>
          Holder count uses Koios estimated counting — refreshed daily.
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <OnChainRow label="Total Supply" value={supply ?? "—"} sub={supply ? "decimals-adjusted" : undefined} />
        <OnChainRow
          label="Holders"
          value={detail.holders != null ? fmtCount(detail.holders) : "—"}
          sub={detail.holders != null ? "holding addresses, estimated" : "estimate pending"}
        />
        <OnChainRow label="Decimals" value={detail.decimals != null ? String(detail.decimals) : "—"} />
        <OnChainRow label="Minted" value={minted ?? "—"} />
        <OnChainRow
          label="Fingerprint"
          value={detail.fingerprint ? shortHex(detail.fingerprint, 12, 8) : "—"}
          title={detail.fingerprint ?? undefined}
          last
        />
      </div>
    </Card>
  );
}

function OnChainRow({
  label,
  value,
  sub,
  title,
  last,
}: {
  label: string;
  value: string;
  sub?: string;
  title?: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--color-border-soft)",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span style={{ textAlign: "right", minWidth: 0 }}>
        <span
          title={title}
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            wordBreak: "break-all",
          }}
        >
          {value}
        </span>
        {sub && (
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: "var(--color-text-muted)",
              marginTop: 2,
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pairs table
// ---------------------------------------------------------------------------

function PairsTable({ pairs, coverage }: { pairs: PairRow[]; coverage?: string }) {
  return (
    <section
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>Pairs</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3, marginBottom: 12 }}>
          Sorted by liquidity
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}>
              <PairTh align="left">DEX</PairTh>
              <PairTh align="left">Pair</PairTh>
              <PairTh align="right">Price</PairTh>
              <PairTh align="right">Liquidity</PairTh>
              <PairTh align="right">24H Vol</PairTh>
              <PairTh align="right">24H Buys / Sells</PairTh>
            </tr>
          </thead>
          <tbody>
            {pairs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  No DEX pairs indexed for this asset yet.
                </td>
              </tr>
            ) : (
              pairs.map((p) => (
                <tr key={p.pairAddress} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
                  <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {dexLabel(p.dexId)}
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)", marginLeft: 6 }}>
                      / {p.quoteSymbol}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                    <a
                      href={httpUrlOrNull(p.url) ?? `https://dexscreener.com/cardano/${p.pairAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={p.pairAddress}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12.5,
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {shortHex(p.pairAddress, 8, 6)}
                      <span style={{ color: "var(--color-text-muted)", display: "inline-flex" }}>
                        <ExternalIcon />
                      </span>
                    </a>
                  </td>
                  <PairTd>{fmtPrice(p.priceUsd)}</PairTd>
                  <PairTd>{fmtUsd(p.liquidityUsd, 2)}</PairTd>
                  <PairTd>{fmtUsd(p.volume24h, 2)}</PairTd>
                  <td
                    style={{
                      padding: "11px 16px",
                      textAlign: "right",
                      fontSize: 12.5,
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.source === "geckoterminal" ? (
                      <span
                        style={{ color: "var(--color-text-muted)" }}
                        title="Buy/sell counts are not reported by GeckoTerminal"
                      >
                        —
                      </span>
                    ) : (
                      <>
                        <span style={{ color: "var(--color-positive)", fontWeight: 700 }}>{fmtCount(p.buys24h)}</span>
                        <span style={{ color: "var(--color-text-muted)", margin: "0 5px" }}>/</span>
                        <span style={{ color: "var(--color-negative)", fontWeight: 700 }}>{fmtCount(p.sells24h)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--color-border-soft)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <CoverageChip text={coverage ? `DEX data: ${coverage}` : undefined} />
        <span style={{ fontSize: 10.5, color: "var(--color-text-muted)" }}>
          Never read these figures as total Cardano volume or liquidity.
        </span>
      </div>
    </section>
  );
}

function PairTh({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "9px 16px",
        textAlign: align,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function PairTd({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "11px 16px",
        textAlign: "right",
        fontSize: 13,
        fontFamily: "var(--font-mono)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------------------
// Live trades (roadmap empty state) + agent card
// ---------------------------------------------------------------------------

function LiveTradesCard() {
  return (
    <Card title="Live Trades">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "26px 16px",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <PulseIcon />
        </span>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", maxWidth: 300, lineHeight: 1.5 }}>
          Live trade feed ships with the Basilisk indexer
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 999,
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-secondary)",
          }}
        >
          Roadmap — in development
        </span>
      </div>
    </Card>
  );
}

function AgentCard({ unit }: { unit: string }) {
  const path = `/api/v1/tokens/${unit}`;
  return (
    <Card
      title="For Agents"
      sub="Everything on this page, machine-readable"
      footer={
        <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          The Basilisk MCP server exposes this same feed as tools for AI agents —{" "}
          <Link href="/agents" style={{ color: "var(--color-brand)", fontWeight: 600 }}>
            connect an agent
          </Link>
          .
        </span>
      }
    >
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          borderRadius: 6,
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-text-secondary)",
          minWidth: 0,
        }}
      >
        <span style={{ color: "var(--color-brand)", display: "inline-flex" }}>
          <TerminalIcon />
        </span>
        <span style={{ fontWeight: 700, color: "var(--color-brand)" }}>GET</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {path}
        </span>
        <span style={{ color: "var(--color-text-muted)", display: "inline-flex" }}>
          <ExternalIcon />
        </span>
      </a>
      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 10, lineHeight: 1.5 }}>
        Free public API — no key required. JSON mirrors this page: price, pairs, buy/sell counts, and
        Koios on-chain facts.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton + not-found
// ---------------------------------------------------------------------------

function PageSkeleton({ unit }: { unit: string }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${shortHex(unit)}`}>
      <Sk w={160} h={12} mb={22} />
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: 10,
            background: "var(--color-bg-hover)",
            opacity: 0.55,
            display: "block",
          }}
        />
        <div>
          <Sk w={220} h={20} mb={8} />
          <Sk w={140} h={11} />
        </div>
      </div>
      <div
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "18px 20px",
          marginBottom: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 18,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <Sk w={70} h={9} mb={10} />
            <Sk w={100} h={i === 0 ? 24 : 15} />
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 14,
        }}
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "18px 20px",
            }}
          >
            <Sk w={140} h={13} mb={18} />
            <Sk w="100%" h={10} mb={14} />
            <Sk w="86%" h={10} mb={14} />
            <Sk w="92%" h={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div style={{ padding: "48px 0", maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Token not found</h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
        Nothing on DexScreener or Koios matches{" "}
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--color-bg-elevated)",
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid var(--color-border)",
            wordBreak: "break-all",
          }}
        >
          {id}
        </code>
        .
      </p>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 18 }}>
        Token pages use the Cardano asset unit — policy ID plus asset name hex, e.g.{" "}
        <span style={{ fontFamily: "var(--font-mono)" }}>279c909f…534e454b</span> for SNEK.
      </p>
      <Link href="/screener" style={{ color: "var(--color-brand)", fontSize: 13, fontWeight: 600 }}>
        ← Back to screener
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy CoinGecko fallback — old /tokens/{coingecko-id} links keep resolving.
// ---------------------------------------------------------------------------

function LegacyTokenPage({ id }: { id: string }) {
  const [token, setToken] = useState<LegacyTokenDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLegacyDetail(id).then((t) => {
      if (cancelled) return;
      setToken(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <PageSkeleton unit={id} />;
  if (!token) return <NotFound id={id} />;

  return (
    <div>
      <Breadcrumb symbol={token.symbol} />

      <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {token.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={token.imageUrl}
            alt={token.name}
            width={46}
            height={46}
            style={{ borderRadius: 10, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
          />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6 }}>{token.name}</h1>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
              {token.symbol}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 4,
                color: "var(--color-text-muted)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              Legacy CoinGecko listing
            </span>
          </div>
          {token.description && (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.55, maxWidth: 720 }}>
              {token.description}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{fmtPrice(token.price)}</div>
          {token.change24h != null && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: token.change24h >= 0 ? "var(--color-positive)" : "var(--color-negative)",
              }}
            >
              {fmtPct(token.change24h)} (24H)
            </div>
          )}
        </div>
      </header>

      <div
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "18px 20px",
          marginBottom: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 18,
        }}
      >
        <BandStat label="Market Cap" value={fmtUsd(token.marketCap, 2)} />
        <BandStat label="24H Volume" value={fmtUsd(token.volume24h, 2)} />
        <BandStat label="FDV" value={token.fdv != null ? fmtUsd(token.fdv, 2) : "—"} />
        <BandStat
          label="Circulating Supply"
          value={`${fmtCount(Math.round(token.circulatingSupply))} ${token.symbol}`}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {token.homepage && (
          <LinkChip href={token.homepage} icon={<GlobeIcon />}>
            {hostnameOf(token.homepage)}
          </LinkChip>
        )}
        {token.twitter && (
          <LinkChip href={`https://x.com/${token.twitter}`} icon={<XIcon />}>
            @{token.twitter}
          </LinkChip>
        )}
        {token.policyId && <CopyChip label="Policy" value={token.policyId} />}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.6, maxWidth: 640 }}>
        This is a legacy CoinGecko-indexed page. New token pages are keyed by policy ID with DEX pairs
        and on-chain data —{" "}
        <Link href="/screener" style={{ color: "var(--color-brand)", fontWeight: 600 }}>
          browse the screener
        </Link>
        . Market data via CoinGecko.
      </p>
    </div>
  );
}
