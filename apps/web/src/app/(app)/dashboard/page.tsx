"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactDOM from "react-dom";
import {
  fetchChainTip,
  fetchAdaMarket,
  fetchAdaSeries,
  fmtUsd,
  fmtPct,
  fmtCount,
  type ChainTip,
  type AdaMarket,
} from "../../../lib/public-data";
import type { ScreenerResponse, ScreenerToken } from "../../../lib/dex-data";

type Timeframe = "1H" | "4H" | "1D" | "1W";

// Next's app router ships React canary, where ReactDOM.preload exists at
// runtime — @types/react-dom@18 just doesn't declare it yet.
const preloadFetch = (
  ReactDOM as unknown as {
    preload?: (href: string, opts: { as: string; crossOrigin?: string }) => void;
  }
).preload;

export default function DashboardPage() {
  // Warm the movers data: emits <link rel="preload" as="fetch"> in the SSR
  // head so the request starts before hydration + the client effect run.
  preloadFetch?.("/api/v1/tokens", { as: "fetch", crossOrigin: "anonymous" });

  const [tip, setTip] = useState<ChainTip | null>(null);
  const [ada, setAda] = useState<AdaMarket | null>(null);
  const [gainers, setGainers] = useState<ScreenerToken[]>([]);
  const [losers, setLosers] = useState<ScreenerToken[]>([]);
  const [moversLoading, setMoversLoading] = useState(true);

  useEffect(() => {
    fetchChainTip().then(setTip).catch(() => {});
    fetchAdaMarket().then(setAda).catch(() => {});
    let cancelled = false;
    fetch("/api/v1/tokens")
      .then(async (res) => {
        if (!res.ok) throw new Error(`screener ${res.status}`);
        return (await res.json()) as ScreenerResponse;
      })
      .then((data) => {
        if (cancelled) return;
        const withChange = data.tokens.filter((t) => t.change24h != null);
        setGainers(
          withChange
            .filter((t) => (t.change24h ?? 0) > 0)
            .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
            .slice(0, 5)
        );
        setLosers(
          withChange
            .filter((t) => (t.change24h ?? 0) < 0)
            .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
            .slice(0, 5)
        );
        setMoversLoading(false);
      })
      .catch(() => {
        if (!cancelled) setMoversLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const epochProgress = tip ? Math.round((tip.epochSlot / 432000) * 100) : null;

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Cardano market overview · powered by{" "}
          <a href="https://www.koios.rest" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>
            Koios
          </a>{" "}
          +{" "}
          <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>
            CoinGecko
          </a>
        </p>
      </header>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <Stat
          label="ADA Price"
          value={ada ? fmtUsd(ada.price, 4) : "—"}
          delta={ada ? fmtPct(ada.change24h) : undefined}
          positive={ada ? ada.change24h >= 0 : undefined}
        />
        <Stat
          label="Market Cap"
          value={ada ? fmtUsd(ada.marketCap) : "—"}
          delta={ada ? fmtPct(ada.change24h) : undefined}
          positive={ada ? ada.change24h >= 0 : undefined}
        />
        <Stat
          label="24H Volume"
          value={ada ? fmtUsd(ada.volume24h) : "—"}
        />
        <Stat
          label="Epoch"
          value={tip ? fmtCount(tip.epoch) : "—"}
          sub={tip && epochProgress != null ? `${epochProgress}% complete` : undefined}
        />
      </div>

      {/* Chart + movers */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
        <ChartTile ada={ada} />
        <MoversTile gainers={gainers} losers={losers} loading={moversLoading} />
      </div>

      {/* Network activity */}
      <NetworkActivity tip={tip} />
    </div>
  );
}

/* ─── Tiles ──────────────────────────────────────────────── */

function Stat({ label, value, delta, sub, positive }: {
  label: string; value: string; delta?: string; sub?: string; positive?: boolean;
}) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</span>
        {delta && (
          <span style={{ fontSize: 12, fontWeight: 700, color: positive ? "var(--color-positive)" : "var(--color-negative)" }}>
            {delta}
          </span>
        )}
        {sub && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

function ChartTile({ ada }: { ada: AdaMarket | null }) {
  const [tf, setTf] = useState<Timeframe>("1D");
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const baseDays = tf === "1W" ? 7 : 1;
    fetchAdaSeries(baseDays).then((all) => {
      if (cancelled) return;
      if (!all || all.length === 0) {
        setSeries([]);
        setLoading(false);
        return;
      }
      const now = all[all.length - 1][0];
      const windowMs =
        tf === "1H" ? 60 * 60_000 :
        tf === "4H" ? 4 * 60 * 60_000 :
        tf === "1D" ? 24 * 60 * 60_000 :
        7 * 24 * 60 * 60_000;
      const sliced = all.filter(([t]) => t >= now - windowMs);
      setSeries(sliced.length > 1 ? sliced : all);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tf]);

  const w = 600, h = 240, pad = 8;
  const hasData = series.length > 1;
  const first = hasData ? series[0][1] : 0;
  const last = hasData ? series[series.length - 1][1] : 0;
  const tfChange = hasData ? ((last - first) / first) * 100 : 0;
  const trendUp = hasData ? last >= first : (!ada || ada.change24h >= 0);

  let line = "";
  let area = "";
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
      border: "1px solid var(--color-border)", padding: 18, minHeight: 280,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8 }}>
            ADA/USD
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              {ada ? fmtUsd(ada.price, 4) : (hasData ? fmtUsd(last, 4) : "—")}
            </span>
            {hasData && (
              <span style={{ fontSize: 11, fontWeight: 600, color: trendUp ? "var(--color-positive)" : "var(--color-negative)" }}>
                {fmtPct(tfChange)} <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>· {tf}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
            CoinGecko · {series.length} points
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--color-bg-secondary)", borderRadius: 6, border: "1px solid var(--color-border)" }}>
          {(["1H", "4H", "1D", "1W"] as Timeframe[]).map((t) => {
            const active = tf === t;
            return (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 240, display: "block" }}>
        <defs>
          <linearGradient id="dashUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(32,235,122,0.35)" />
            <stop offset="100%" stopColor="rgba(32,235,122,0)" />
          </linearGradient>
          <linearGradient id="dashDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,66,43,0.30)" />
            <stop offset="100%" stopColor="rgba(255,66,43,0)" />
          </linearGradient>
        </defs>
        {hasData ? (
          <>
            <path d={area} fill={trendUp ? "url(#dashUp)" : "url(#dashDown)"} />
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

function fmtTokenPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v <= 0) return "$0.00";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.01) return "$" + v.toFixed(4);
  const decimals = Math.min(11, 3 - Math.floor(Math.log10(v)));
  return "$" + v.toFixed(decimals);
}

/** 20px token avatar via the logo proxy — hides itself if the logo 404s. */
function MoverLogo({ address, symbol }: { address: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        background: "var(--color-bg-hover)", border: "1px solid var(--color-border)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700, color: "var(--color-text-secondary)",
      }}>
        {symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/v1/tokens/${address}/logo`}
      alt=""
      width={20}
      height={20}
      onError={() => setFailed(true)}
      style={{ borderRadius: "50%", flexShrink: 0, background: "var(--color-bg-hover)", objectFit: "cover" }}
    />
  );
}

function MoversTile({ gainers, losers, loading }: { gainers: ScreenerToken[]; losers: ScreenerToken[]; loading: boolean }) {
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const rows = tab === "gainers" ? gainers : losers;

  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Top Movers</div>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 0.6 }}>CNT · 24H</span>
      </div>
      <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--color-bg-secondary)", borderRadius: 6, border: "1px solid var(--color-border)", marginBottom: 10 }}>
        {(["gainers", "losers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "5px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
              background: tab === t ? "var(--color-bg-hover)" : "transparent",
              color: tab === t ? "var(--color-text-primary)" : "var(--color-text-muted)",
              textTransform: "uppercase",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          [0,1,2,3,4].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)" }}>
              <span style={{ width: 60, height: 10, background: "var(--color-bg-secondary)", borderRadius: 3 }} />
              <span style={{ width: 40, height: 10, background: "var(--color-bg-secondary)", borderRadius: 3 }} />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", padding: "16px 0" }}>
            No {tab} right now
          </div>
        ) : (
          rows.map((r) => {
            const pct = r.change24h ?? 0;
            const positive = pct >= 0;
            return (
              <Link
                key={r.address}
                href={`/tokens/${r.address}`}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)",
                  color: "inherit",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <MoverLogo address={r.address} symbol={r.symbol} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{r.symbol}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                    {fmtTokenPrice(r.priceUsd)}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                    padding: "2px 7px", borderRadius: 999,
                    background: positive ? "var(--color-brand-soft)" : "rgba(255, 66, 43, 0.12)",
                    color: positive ? "var(--color-positive)" : "var(--color-negative)",
                  }}>
                    {fmtPct(pct)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function NetworkActivity({ tip }: { tip: ChainTip | null }) {
  const blockAge = tip ? Math.max(0, Math.floor(Date.now() / 1000 - tip.blockTime)) : null;

  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Network</div>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 0.6 }}>KOIOS · MAINNET</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Row label="Latest block" value={tip ? fmtCount(tip.block) : "—"} />
        <Row label="Block age" value={blockAge != null ? `${blockAge}s ago` : "—"} />
        <Row label="Epoch slot" value={tip ? fmtCount(tip.epochSlot) : "—"} />
        <Row label="Tip hash" value={tip ? `${tip.hash.slice(0, 8)}…` : "—"} mono />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? "var(--font-mono)" : "inherit" }}>{value}</div>
    </div>
  );
}
