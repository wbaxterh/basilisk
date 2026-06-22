"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchCardanoTokens,
  fmtUsd,
  fmtPct,
  type CntToken,
} from "../../../lib/public-data";

type Tab = "top" | "gainers" | "losers" | "volume";
type SortKey = "rank" | "price" | "change24h" | "marketCap" | "volume24h";

const TABS: { key: Tab; label: string; help: string }[] = [
  { key: "top", label: "Top", help: "By market cap" },
  { key: "gainers", label: "Gainers", help: "Best 24H performers" },
  { key: "losers", label: "Losers", help: "Worst 24H performers" },
  { key: "volume", label: "Volume", help: "By 24H trading volume" },
];

export default function ScreenerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("top");
  const [search, setSearch] = useState("");
  const [tokens, setTokens] = useState<CntToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCardanoTokens(100)
      .then((data) => {
        if (cancelled) return;
        setTokens(data);
        setError(data.length === 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = [...tokens];
    if (activeTab === "gainers") {
      list = list.filter((t) => (t.change24h ?? 0) > 0);
    } else if (activeTab === "losers") {
      list = list.filter((t) => (t.change24h ?? 0) < 0);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }
    // Apply tab-default sort, then allow column overrides
    if (activeTab === "gainers")  list.sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
    else if (activeTab === "losers") list.sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0));
    else if (activeTab === "volume") list.sort((a, b) => b.volume24h - a.volume24h);
    else list.sort((a, b) => b.marketCap - a.marketCap);

    if (sortKey !== "rank") {
      list.sort((a, b) => {
        let aVal = 0, bVal = 0;
        switch (sortKey) {
          case "price":     aVal = a.price;       bVal = b.price;       break;
          case "change24h": aVal = a.change24h ?? 0; bVal = b.change24h ?? 0; break;
          case "marketCap": aVal = a.marketCap;   bVal = b.marketCap;   break;
          case "volume24h": aVal = a.volume24h;   bVal = b.volume24h;   break;
        }
        return sortDesc ? bVal - aVal : aVal - bVal;
      });
    }
    return list;
  }, [tokens, activeTab, search, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
          Market Screener
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Cardano native tokens, live · powered by{" "}
          <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>
            CoinGecko
          </a>
        </p>
      </header>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--color-bg-elevated)", borderRadius: 6, border: "1px solid var(--color-border)" }}>
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSortKey("rank"); }}
                title={t.help}
                style={{
                  padding: "6px 14px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                  textTransform: "uppercase",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search symbol or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, maxWidth: 320,
            padding: "8px 12px", background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)", borderRadius: 6,
            color: "var(--color-text-primary)", fontSize: 13, outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)", overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}>
                <Th label="#" k="rank" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} width={50} align="left" />
                <Th label="Token" k="rank" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} align="left" />
                <Th label="Price" k="price" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} align="right" />
                <Th label="24H %" k="change24h" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} align="right" />
                <Th label="Market Cap" k="marketCap" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} align="right" />
                <Th label="24H Vol" k="volume24h" sortKey={sortKey} sortDesc={sortDesc} onClick={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                    Could not load tokens. Try again later.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                    No results.
                  </td>
                </tr>
              ) : (
                filtered.map((t, i) => <Row key={t.id} token={t} rank={i + 1} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !error && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 10, letterSpacing: 0.3 }}>
          {filtered.length} of {tokens.length} tokens · click a row for token detail
        </div>
      )}
    </div>
  );
}

function Th({ label, k, sortKey, sortDesc, onClick, align, width }: {
  label: string; k: SortKey; sortKey: SortKey; sortDesc: boolean;
  onClick: (k: SortKey) => void; align: "left" | "right"; width?: number;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onClick(k)}
      style={{
        padding: "10px 14px", textAlign: align,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
        color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
        cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        width: width ? `${width}px` : undefined,
      }}
    >
      {label}
      {active && <span style={{ marginLeft: 4 }}>{sortDesc ? "↓" : "↑"}</span>}
    </th>
  );
}

function Row({ token, rank }: { token: CntToken; rank: number }) {
  const pct = token.change24h ?? 0;
  return (
    <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
      <Td><span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{rank}</span></Td>
      <Td>
        <Link href={`/tokens/${token.id}`} style={{ display: "flex", flexDirection: "column", color: "inherit" }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{token.symbol}</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{token.name}</span>
        </Link>
      </Td>
      <Td align="right" mono>{fmtUsd(token.price, token.price < 1 ? 4 : 2)}</Td>
      <Td align="right">
        <span style={{ fontSize: 13, fontWeight: 600, color: pct >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
          {fmtPct(pct)}
        </span>
      </Td>
      <Td align="right" mono>{fmtUsd(token.marketCap)}</Td>
      <Td align="right" mono>{fmtUsd(token.volume24h)}</Td>
    </tr>
  );
}

function Td({ children, align = "left", mono }: {
  children: React.ReactNode; align?: "left" | "right"; mono?: boolean;
}) {
  return (
    <td style={{
      padding: "10px 14px", textAlign: align, fontSize: 13,
      fontFamily: mono ? "var(--font-mono)" : "inherit",
      whiteSpace: "nowrap",
    }}>
      {children}
    </td>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <span style={{ display: "block", height: 10, width: "60%", background: "var(--color-bg-secondary)", borderRadius: 3 }} />
        </td>
      ))}
    </tr>
  );
}
