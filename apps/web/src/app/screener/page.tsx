"use client";

import { useEffect, useState } from "react";
import { fetchPrices } from "../../lib/api";
import EmptyState from "../../components/EmptyState";

interface PriceRow {
  asset: string;
  priceAda: string;
  priceUsd: string | null;
  volumeAda: string;
  timestamp: number;
}

export default function ScreenerPage() {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPrices(100)
      .then((data) => {
        setPrices(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Market Screener
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Top tokens, biggest movers, trending, and new listings.
      </p>

      {loading ? (
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 40,
          textAlign: "center",
          color: "var(--color-text-muted)",
        }}>
          Loading market data...
        </div>
      ) : error || prices.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={error ? "API offline" : "No market data yet"}
          description={error
            ? "Start the API gateway and ingestion service to see live market data."
            : "Once the ingestion and pricing services are running, tokens will appear here."
          }
        />
      ) : (
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 16,
            padding: "12px 20px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
          }}>
            <span>Asset</span>
            <span style={{ textAlign: "right" }}>Price (ADA)</span>
            <span style={{ textAlign: "right" }}>Price (USD)</span>
            <span style={{ textAlign: "right" }}>Volume (ADA)</span>
          </div>
          {/* Rows */}
          {prices.map((p) => (
            <div
              key={p.asset}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 16,
                padding: "12px 20px",
                borderBottom: "1px solid var(--color-border)",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                transition: "background 0.1s",
              }}
            >
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                {p.asset.length > 30 ? `${p.asset.slice(0, 12)}...${p.asset.slice(-8)}` : p.asset}
              </span>
              <span style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>
                {parseFloat(p.priceAda).toFixed(6)}
              </span>
              <span style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>
                {p.priceUsd ? `$${parseFloat(p.priceUsd).toFixed(4)}` : "—"}
              </span>
              <span style={{ textAlign: "right", color: "var(--color-text-muted)" }}>
                {formatVolume(p.volumeAda)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatVolume(lovelace: string): string {
  const ada = Number(lovelace) / 1_000_000;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`;
  return ada.toFixed(0);
}
