"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchCardanoTokens, fmtUsd, fmtPct, type CntToken } from "../../../lib/public-data";

export default function TokensPage() {
  const [tokens, setTokens] = useState<CntToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCardanoTokens(100).then((data) => {
      setTokens(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return tokens;
    const q = search.toLowerCase();
    return tokens.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [tokens, search]);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
          Tokens
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Cardano native tokens, sorted by market cap.
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", maxWidth: 320,
            padding: "8px 12px", background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)", borderRadius: 6,
            color: "var(--color-text-primary)", fontSize: 13, outline: "none",
          }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)", padding: 16, minHeight: 110,
            }}>
              <span style={{ display: "block", height: 12, width: "40%", background: "var(--color-bg-secondary)", borderRadius: 3, marginBottom: 8 }} />
              <span style={{ display: "block", height: 18, width: "70%", background: "var(--color-bg-secondary)", borderRadius: 3 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            No tokens found.
          </div>
        ) : (
          filtered.map((t, i) => <TokenCard key={t.id} token={t} rank={i + 1} />)
        )}
      </div>
    </div>
  );
}

function TokenCard({ token, rank }: { token: CntToken; rank: number }) {
  const pct = token.change24h ?? 0;
  return (
    <Link
      href={`/tokens/${token.id}`}
      style={{
        background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)", padding: 16,
        display: "flex", flexDirection: "column", gap: 8,
        color: "inherit", textDecoration: "none",
        transition: "border-color 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>#{rank}</span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{token.symbol}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
          {fmtPct(pct)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {token.name}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
          {fmtUsd(token.price, token.price < 1 ? 4 : 2)}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
          MC {fmtUsd(token.marketCap)}
        </span>
      </div>
    </Link>
  );
}
