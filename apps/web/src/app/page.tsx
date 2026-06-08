"use client";

import { useEffect, useState } from "react";
import { fetchStats, fetchScreenerTop, type ScreenerRow } from "../lib/api";

interface Stats {
  latestBlock: { height: number; epoch: number; timestamp: number } | null;
  transactions24h: number;
  dexVolumeLovelace24h: string;
}

interface AdaMarket {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

async function fetchAdaMarket(): Promise<AdaMarket> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
  );
  if (!res.ok) throw new Error("CoinGecko fetch failed");
  const data = await res.json();
  const ada = data.cardano;
  return {
    price: ada.usd,
    change24h: ada.usd_24h_change,
    marketCap: ada.usd_market_cap,
    volume24h: ada.usd_24h_vol,
  };
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [adaMarket, setAdaMarket] = useState<AdaMarket | null>(null);
  const [topMovers, setTopMovers] = useState<ScreenerRow[]>([]);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        setStats(data);
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));

    fetchAdaMarket()
      .then(setAdaMarket)
      .catch(() => {});

    fetchScreenerTop(5)
      .then(setTopMovers)
      .catch(() => {});
  }, []);

  const epoch = stats?.latestBlock?.epoch ?? "—";
  const txCount = apiOnline ? stats?.transactions24h?.toLocaleString() ?? "—" : "—";
  const dexVol = apiOnline
    ? formatLovelace(stats?.dexVolumeLovelace24h ?? "0")
    : "—";

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Dashboard
      </h1>
      <p style={{
        color: "var(--color-text-secondary)",
        fontSize: 14,
        marginBottom: 24,
      }}>
        Cardano market overview and portfolio summary.
        {!apiOnline && (
          <span style={{
            marginLeft: 12,
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(245, 158, 11, 0.1)",
            color: "var(--color-warning)",
          }}>
            API offline — showing placeholder data
          </span>
        )}
      </p>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          label="ADA Price"
          value={adaMarket ? `$${adaMarket.price.toFixed(4)}` : "$—"}
          change={adaMarket ? `${adaMarket.change24h >= 0 ? "+" : ""}${adaMarket.change24h.toFixed(1)}%` : undefined}
          positive={adaMarket ? adaMarket.change24h >= 0 : undefined}
        />
        <StatCard
          label="Market Cap"
          value={adaMarket ? `$${formatLargeUsd(adaMarket.marketCap)}` : "$—"}
        />
        <StatCard label="24h DEX Volume" value={dexVol} />
        <StatCard label="Epoch" value={String(epoch)} sublabel={`${txCount} txs (24h)`} />
      </div>

      {/* Two-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}>
        {/* Top Movers */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Top Movers (24h)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topMovers.length > 0 ? (
              topMovers.map((m) => (
                <TokenRow
                  key={m.asset}
                  rank={m.rank}
                  name={m.ticker || m.asset.slice(0, 8) + "..."}
                  price={parseFloat(m.priceAda).toFixed(4)}
                  change={m.change24h ? `${parseFloat(m.change24h) >= 0 ? "+" : ""}${m.change24h}%` : "—"}
                  positive={m.change24h ? parseFloat(m.change24h) >= 0 : true}
                />
              ))
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                Waiting for DEX data...
              </div>
            )}
          </div>
        </div>

        {/* Network Activity */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Network Activity
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ActivityRow label="Transactions (24h)" value={txCount} />
            <ActivityRow label="DEX Volume (24h)" value={dexVol} />
            <ActivityRow label="Latest Block" value={stats?.latestBlock?.height?.toLocaleString() ?? "—"} />
            <ActivityRow label="Epoch" value={String(epoch)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLargeUsd(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatLovelace(lovelace: string): string {
  const ada = Number(lovelace) / 1_000_000;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M ADA`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K ADA`;
  return `${ada.toFixed(0)} ADA`;
}

function StatCard({ label, value, change, sublabel, positive }: {
  label: string;
  value: string;
  change?: string;
  sublabel?: string;
  positive?: boolean;
}) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: "16px 20px",
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: "var(--color-text-muted)",
        marginBottom: 8,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {value}
        </span>
        {change && (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: positive ? "var(--color-positive)" : "var(--color-negative)",
          }}>
            {change}
          </span>
        )}
      </div>
      {sublabel && (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function TokenRow({ rank, name, price, change, positive }: {
  rank: number; name: string; price: string; change: string; positive: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--color-bg-hover)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", width: 20, textAlign: "center" as const }}>{rank}</span>
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>{price} ADA</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: positive ? "var(--color-positive)" : "var(--color-negative)", minWidth: 60, textAlign: "right" as const }}>{change}</span>
      </div>
    </div>
  );
}

function ActivityRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: "var(--radius-md)", background: "var(--color-bg-hover)",
    }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}
