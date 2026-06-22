"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchTokenDetail,
  fetchTokenSeries,
  fmtUsd,
  fmtPct,
  fmtCount,
  type TokenDetail,
} from "../../../../lib/public-data";

type Timeframe = "1D" | "7D" | "30D" | "1Y";
const TF_TO_DAYS: Record<Timeframe, number> = { "1D": 1, "7D": 7, "30D": 30, "1Y": 365 };

export default function TokenDetailPage() {
  const params = useParams<{ asset: string }>();
  const id = decodeURIComponent(params.asset);
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTokenDetail(id).then((t) => {
      if (!t) setNotFound(true);
      setToken(t);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 40, color: "var(--color-text-muted)", fontSize: 13 }}>
        Loading {id}…
      </div>
    );
  }

  if (notFound || !token) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Token not found</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          We couldn&apos;t resolve <code style={{ background: "var(--color-bg-elevated)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--color-border)" }}>{id}</code> on CoinGecko. The ID may be wrong or unlisted.
        </p>
        <Link href="/screener" style={{ color: "var(--color-brand)", fontSize: 13 }}>← Back to screener</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 18, fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href="/screener" style={{ color: "var(--color-text-secondary)" }}>Screener</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span>{token.symbol}</span>
      </nav>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {token.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.imageUrl} alt={token.name} width={48} height={48} style={{ borderRadius: 8, background: "var(--color-bg-elevated)" }} />
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6 }}>{token.name}</h1>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
              {token.symbol}
            </span>
            {token.marketCapRank && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                padding: "3px 8px", borderRadius: 3, color: "var(--color-text-secondary)",
                background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
              }}>
                RANK #{token.marketCapRank}
              </span>
            )}
          </div>
          {token.description && (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.55, maxWidth: 760 }}>
              {token.description}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {fmtUsd(token.price, token.price < 1 ? 4 : 2)}
          </div>
          {token.change24h != null && (
            <div style={{ fontSize: 13, fontWeight: 600, color: token.change24h >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
              {fmtPct(token.change24h)} (24H)
            </div>
          )}
        </div>
      </header>

      {/* Chart */}
      <PriceChart id={token.id} symbol={token.symbol} />

      {/* Stat grid */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Stat label="Market Cap" value={fmtUsd(token.marketCap)} />
        <Stat label="24H Volume" value={fmtUsd(token.volume24h)} />
        <Stat
          label="24H Range"
          value={`${fmtUsd(token.low24h, token.low24h < 1 ? 4 : 2)} — ${fmtUsd(token.high24h, token.high24h < 1 ? 4 : 2)}`}
        />
        <Stat
          label="All-Time High"
          value={fmtUsd(token.ath, token.ath < 1 ? 4 : 2)}
          sub={token.athChangePct != null ? `${fmtPct(token.athChangePct)} from ATH` : undefined}
          subColor={token.athChangePct != null && token.athChangePct >= 0 ? "positive" : "negative"}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Stat label="Circulating Supply" value={`${fmtCount(Math.round(token.circulatingSupply))} ${token.symbol}`} />
        <Stat label="Max Supply" value={token.maxSupply ? `${fmtCount(Math.round(token.maxSupply))} ${token.symbol}` : "∞"} />
        <Stat label="FDV" value={token.fdv ? fmtUsd(token.fdv) : "—"} />
        <Stat
          label="Multi-period change"
          value={`24H ${token.change24h != null ? fmtPct(token.change24h) : "—"}`}
          sub={`7D ${token.change7d != null ? fmtPct(token.change7d) : "—"} · 30D ${token.change30d != null ? fmtPct(token.change30d) : "—"}`}
        />
      </div>

      {/* Links */}
      {(token.homepage || token.twitter || token.policyId) && (
        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {token.homepage && (
            <ExternalLink href={token.homepage} label="Website" />
          )}
          {token.twitter && (
            <ExternalLink href={`https://x.com/${token.twitter}`} label={`@${token.twitter}`} />
          )}
          {token.policyId && (
            <span style={{
              padding: "8px 12px", borderRadius: 6,
              background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
              fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)",
            }}>
              policy {token.policyId.slice(0, 12)}…
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: "var(--color-text-muted)" }}>
        Market data via{" "}
        <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>CoinGecko</a>
      </div>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        padding: "8px 12px", borderRadius: 6,
        background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
        fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)",
      }}
    >
      {label} ↗
    </a>
  );
}

function Stat({ label, value, sub, subColor }: {
  label: string; value: string; sub?: string; subColor?: "positive" | "negative";
}) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</div>
      {sub && (
        <div style={{
          marginTop: 4, fontSize: 11,
          color: subColor === "positive" ? "var(--color-positive)" : subColor === "negative" ? "var(--color-negative)" : "var(--color-text-muted)",
          fontFamily: subColor ? "var(--font-mono)" : "inherit",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PriceChart({ id, symbol }: { id: string; symbol: string }) {
  const [tf, setTf] = useState<Timeframe>("7D");
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTokenSeries(id, TF_TO_DAYS[tf]).then((data) => {
      if (cancelled) return;
      setSeries(data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, tf]);

  const w = 800, h = 280, pad = 8;
  const hasData = series.length > 1;
  const first = hasData ? series[0][1] : 0;
  const last = hasData ? series[series.length - 1][1] : 0;
  const tfChange = hasData ? ((last - first) / first) * 100 : 0;
  const trendUp = hasData ? last >= first : true;

  let line = "", area = "";
  if (hasData) {
    const vals = series.map((p) => p[1]);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const xStep = (w - pad * 2) / (series.length - 1);
    const norm = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
    line = series.map(([, v], i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${norm(v)}`).join(" ");
    area = `${line} L ${pad + (series.length - 1) * xStep} ${h} L ${pad} ${h} Z`;
  }

  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8 }}>
            {symbol}/USD
            {hasData && (
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {fmtUsd(last, last < 1 ? 4 : 2)}
              </span>
            )}
            {hasData && (
              <span style={{ fontSize: 12, fontWeight: 600, color: trendUp ? "var(--color-positive)" : "var(--color-negative)" }}>
                {fmtPct(tfChange)} <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>· {tf}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
            CoinGecko · {series.length} points
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--color-bg-secondary)", borderRadius: 6, border: "1px solid var(--color-border)" }}>
          {(["1D", "7D", "30D", "1Y"] as Timeframe[]).map((t) => {
            const active = tf === t;
            return (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 280, display: "block" }}>
        <defs>
          <linearGradient id="tokenUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(32,235,122,0.35)" />
            <stop offset="100%" stopColor="rgba(32,235,122,0)" />
          </linearGradient>
          <linearGradient id="tokenDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,66,43,0.30)" />
            <stop offset="100%" stopColor="rgba(255,66,43,0)" />
          </linearGradient>
        </defs>
        {hasData ? (
          <>
            <path d={area} fill={trendUp ? "url(#tokenUp)" : "url(#tokenDown)"} />
            <path d={line} fill="none" stroke={trendUp ? "var(--color-brand)" : "var(--color-negative)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <text x={w / 2} y={h / 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="11" fontFamily="var(--font-mono)">
            {loading ? "loading…" : "no data"}
          </text>
        )}
      </svg>
    </div>
  );
}
