"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtUsd } from "../../../lib/public-data";
import type { DefiOverview } from "../../../lib/defi-data";

/* ─── PRIME program constants ─────────────────────────────────────────────
 * STATUS: update on enactment — the ₳120M Cardano PRIME budget proposal
 * (AlphaGrowth) is in DRep voting as of July 2026. Do NOT flip this to
 * "ENACTED" until the on-chain governance action actually ratifies.
 * Baseline/target are the PROPOSAL'S OWN planning figures ($90M → $290M
 * DeFi TVL), not guarantees. Qualifying TVL under PRIME is attribution-
 * adjusted (excludes ADA price appreciation etc.) — the raw DefiLlama TVL
 * shown here is directional context, not the program's official metric. */
const PRIME_STATUS = "PROPOSAL — VOTING";
const PRIME_BASELINE_USD = 90_000_000;
const PRIME_TARGET_USD = 290_000_000;
const PRIME_PDF_URL =
  "https://gateway.pinata.cloud/ipfs/bafkreia7aqyzjyydj6a6qtpopasbj5z46rlghvjpwlxblspapjtxj6ykge";

type Range = "90D" | "1Y" | "ALL";

export default function DefiPage() {
  const [data, setData] = useState<DefiOverview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/defi")
      .then(async (res) => {
        if (!res.ok) throw new Error(`defi ${res.status}`);
        return (await res.json()) as DefiOverview;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
            DeFi
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Cardano DeFi scoreboard · TVL, stablecoins, and the PRIME growth program
          </p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: 999,
            padding: "5px 12px",
            whiteSpace: "nowrap",
          }}
        >
          DefiLlama · refreshed 10min
        </span>
      </header>

      {failed ? (
        <div
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "32px 20px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--color-text-secondary)",
          }}
        >
          DeFi data is temporarily unavailable — DefiLlama did not respond. Refresh to retry.
        </div>
      ) : (
        <>
          <HeroBand data={data} />
          <PrimeTracker data={data} />
          <TvlChart data={data} />
          <ProtocolsTable data={data} />
          <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 14, lineHeight: 1.6 }}>
            TVL data:{" "}
            <a
              href="https://defillama.com/chain/Cardano"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-brand)" }}
            >
              DefiLlama
            </a>{" "}
            (community standard, PRIME&apos;s own baseline source). Chain TVL excludes CEXs and
            de-duplicates bridged liquidity, so per-protocol TVLs won&apos;t sum to the headline
            number. 7d change in the table is protocol-wide (all chains) per DefiLlama.
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Hero band ──────────────────────────────────────────── */

function HeroBand({ data }: { data: DefiOverview | null }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {/* TVL now */}
      <div style={heroCard}>
        <div style={heroLabel}>Cardano TVL</div>
        {data ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.15 }}>
              {fmtUsd(data.tvl.current)}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <ChangePill label="24H" value={data.tvl.change24h} />
              <ChangePill label="7D" value={data.tvl.change7d} />
            </div>
          </>
        ) : (
          <HeroSkeleton wide />
        )}
      </div>

      {/* Stablecoin supply */}
      <div style={heroCard}>
        <div style={heroLabel}>Stablecoin Supply</div>
        {data ? (
          data.stablecoins ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.15 }}>
                {fmtUsd(data.stablecoins.current)}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <ChangePill label="7D" value={data.stablecoins.change7d} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
              temporarily unavailable
            </div>
          )
        ) : (
          <HeroSkeleton />
        )}
      </div>

      {/* Protocol count */}
      <div style={heroCard}>
        <div style={heroLabel}>DeFi Protocols</div>
        {data ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.15 }}>
              {data.protocolCount}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 8 }}>
              tracked on Cardano · CEXs excluded
            </div>
          </>
        ) : (
          <HeroSkeleton />
        )}
      </div>
    </div>
  );
}

const heroCard: React.CSSProperties = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};

const heroLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  fontWeight: 700,
  marginBottom: 8,
};

function HeroSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div>
      <span className="lp-skeleton" style={{ width: wide ? 140 : 100, height: 28 }} />
      <div style={{ marginTop: 8 }}>
        <span className="lp-skeleton" style={{ width: 72, height: 14 }} />
      </div>
    </div>
  );
}

function ChangePill({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <span style={{ ...pillBase, color: "var(--color-text-muted)", background: "var(--color-bg-secondary)" }}>
        {label} —
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      style={{
        ...pillBase,
        background: positive ? "var(--color-brand-soft)" : "rgba(255, 66, 43, 0.12)",
        color: positive ? "var(--color-positive)" : "var(--color-negative)",
      }}
    >
      {label} {fmtPct(value)}
    </span>
  );
}

const pillBase: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "var(--font-mono)",
  padding: "2px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

/* ─── PRIME tracker ──────────────────────────────────────── */

function PrimeTracker({ data }: { data: DefiOverview | null }) {
  const current = data?.tvl.current ?? null;
  // Progress along the proposal's own planning path: $90M baseline → $290M.
  const pct =
    current != null
      ? Math.min(1, Math.max(0, (current - PRIME_BASELINE_USD) / (PRIME_TARGET_USD - PRIME_BASELINE_USD)))
      : 0;
  const belowBaseline = current != null && current < PRIME_BASELINE_USD;

  return (
    <div
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
            Cardano PRIME — ₳120M treasury program (AlphaGrowth) · in DRep voting
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            Baseline and target are the proposal&apos;s planning figures — not guarantees.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "var(--color-warning, #FFC107)",
              background: "rgba(255, 193, 7, 0.12)",
              border: "1px solid rgba(255, 193, 7, 0.3)",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            {PRIME_STATUS}
          </span>
          <a
            href={PRIME_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--color-brand)",
              border: "1px solid var(--color-border)",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            Proposal PDF ↗
          </a>
        </div>
      </div>

      {/* Progress: $90M baseline → current → $290M target */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            position: "relative",
            height: 10,
            background: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${(pct * 100).toFixed(2)}%`,
              background: "linear-gradient(90deg, var(--color-brand-dim, #16A35A), var(--color-brand))",
              borderRadius: 999,
              transition: "width 600ms ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 6,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
            flexWrap: "wrap",
          }}
        >
          <span>$90M baseline</span>
          <span style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
            {current != null ? (
              <>
                now {fmtUsd(current)}
                {belowBaseline && (
                  <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>
                    {" "}
                    · below baseline
                  </span>
                )}
              </>
            ) : (
              <span className="lp-skeleton" style={{ width: 90, height: 12 }} />
            )}
          </span>
          <span>$290M target</span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        Qualifying TVL under PRIME is attribution-adjusted (excludes ADA price effects etc.) —
        raw DefiLlama TVL shown here is context, not the program metric. Falsification trigger:
        the program pauses for review if month-6 qualifying growth is under $80M.
      </div>
    </div>
  );
}

/* ─── TVL history chart ──────────────────────────────────── */

function TvlChart({ data }: { data: DefiOverview | null }) {
  const [range, setRange] = useState<Range>("1Y");

  const series = useMemo(() => {
    const all = data?.tvl.series ?? [];
    if (all.length === 0) return all;
    if (range === "ALL") return all;
    const days = range === "90D" ? 90 : 365;
    const cutoff = all[all.length - 1][0] - days * 86_400;
    const sliced = all.filter(([t]) => t >= cutoff);
    return sliced.length > 1 ? sliced : all;
  }, [data, range]);

  const w = 900;
  const h = 260;
  const pad = 8;
  const hasData = series.length > 1;
  const first = hasData ? series[0][1] : 0;
  const last = hasData ? series[series.length - 1][1] : 0;
  const rangeChange = hasData && first !== 0 ? ((last - first) / first) * 100 : 0;
  const trendUp = hasData ? last >= first : true;

  let line = "";
  let area = "";
  if (hasData) {
    const vals = series.map((p) => p[1]);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const span = max - min || 1;
    const xStep = (w - pad * 2) / (series.length - 1);
    const norm = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
    line = series.map(([, v], i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${norm(v)}`).join(" ");
    area = `${line} L ${pad + (series.length - 1) * xStep} ${h} L ${pad} ${h} Z`;
  }

  return (
    <div
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            Cardano TVL
            <span style={{ fontFamily: "var(--font-mono)" }}>{hasData ? fmtUsd(last) : "—"}</span>
            {hasData && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: trendUp ? "var(--color-positive)" : "var(--color-negative)",
                }}
              >
                {fmtPct(rangeChange)}{" "}
                <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>· {range}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
            DefiLlama · daily · {series.length} points
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: 2,
            background: "var(--color-bg-secondary)",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
          }}
        >
          {(["90D", "1Y", "ALL"] as Range[]).map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 260, display: "block" }}>
        <defs>
          <linearGradient id="defiTvlUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(32,235,122,0.35)" />
            <stop offset="100%" stopColor="rgba(32,235,122,0)" />
          </linearGradient>
          <linearGradient id="defiTvlDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,66,43,0.30)" />
            <stop offset="100%" stopColor="rgba(255,66,43,0)" />
          </linearGradient>
        </defs>
        {hasData ? (
          <>
            <path d={area} fill={trendUp ? "url(#defiTvlUp)" : "url(#defiTvlDown)"} />
            <path
              d={line}
              fill="none"
              stroke={trendUp ? "var(--color-brand)" : "var(--color-negative)"}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : (
          <text
            x={w / 2}
            y={h / 2}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            fontSize="11"
            fontFamily="var(--font-mono)"
          >
            {data ? "no data" : "loading…"}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ─── Top protocols table ────────────────────────────────── */

/** DefiLlama protocol logo — hides itself on 404 (letter fallback). */
function ProtocolLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          background: "var(--color-bg-hover)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          fontWeight: 700,
          color: "var(--color-text-secondary)",
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={22}
      height={22}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ borderRadius: "50%", flexShrink: 0, background: "var(--color-bg-hover)", objectFit: "cover" }}
    />
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "var(--color-text-muted)",
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "10px 12px",
  borderBottom: "1px solid var(--color-border-soft)",
  whiteSpace: "nowrap",
};

function ProtocolsTable({ data }: { data: DefiOverview | null }) {
  return (
    <div
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Top Protocols by Cardano TVL</div>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Top {data ? Math.min(15, data.protocols.length) : 15} · DefiLlama
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 34 }}>#</th>
              <th style={thStyle}>Protocol</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cardano TVL</th>
              <th style={{ ...thStyle, textAlign: "right" }}>7D (all chains)</th>
            </tr>
          </thead>
          <tbody>
            {data == null
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>
                      <span className="lp-skeleton" style={{ width: 14, height: 10 }} />
                    </td>
                    <td style={tdStyle}>
                      <span className="lp-skeleton" style={{ width: 130, height: 10 }} />
                    </td>
                    <td style={tdStyle}>
                      <span className="lp-skeleton" style={{ width: 60, height: 10 }} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span className="lp-skeleton" style={{ width: 70, height: 10 }} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span className="lp-skeleton" style={{ width: 50, height: 10 }} />
                    </td>
                  </tr>
                ))
              : data.protocols.map((p) => {
                  const nameCell = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <ProtocolLogo src={p.logo} name={p.name} />
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {p.url && <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>↗</span>}
                    </span>
                  );
                  return (
                    <tr key={`${p.rank}-${p.name}`}>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                        {p.rank}
                      </td>
                      <td style={tdStyle}>
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "inherit" }}
                          >
                            {nameCell}
                          </a>
                        ) : (
                          nameCell
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: "var(--color-text-secondary)" }}>{p.category}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {fmtUsd(p.tvlUsd)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color:
                            p.change7d == null
                              ? "var(--color-text-muted)"
                              : p.change7d >= 0
                                ? "var(--color-positive)"
                                : "var(--color-negative)",
                        }}
                      >
                        {p.change7d == null ? "—" : fmtPct(p.change7d)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
