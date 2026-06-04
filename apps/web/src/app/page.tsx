"use client";

import { useEffect, useState } from "react";
import { fetchStats } from "../lib/api";

interface Stats {
  latestBlock: { height: number; epoch: number; timestamp: number } | null;
  transactions24h: number;
  dexVolumeLovelace24h: string;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        setStats(data);
        setApiOnline(true);
      })
      .catch(() => setApiOnline(false));
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
        <StatCard label="ADA Price" value="$0.74" change="+2.3%" positive />
        <StatCard label="Market Cap" value="$26.1B" change="+1.8%" positive />
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
            <TokenRow rank={1} name="MIN" price="0.0412" change="+18.4%" positive />
            <TokenRow rank={2} name="SUNDAE" price="0.0087" change="+12.1%" positive />
            <TokenRow rank={3} name="WRT" price="0.0231" change="+9.7%" positive />
            <TokenRow rank={4} name="LENFI" price="1.24" change="-6.2%" positive={false} />
            <TokenRow rank={5} name="SNEK" price="0.0034" change="-4.8%" positive={false} />
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
