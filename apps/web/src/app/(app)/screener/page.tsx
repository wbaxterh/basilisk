"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchScreenerTop,
  fetchScreenerGainers,
  fetchScreenerLosers,
} from "../../../lib/api";
import type { ScreenerRow } from "../../../lib/api";
import EmptyState from "../../../components/EmptyState";

type Tab = "top" | "gainers" | "losers";

const TABS: { key: Tab; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
];

const FETCHERS: Record<Tab, (limit?: number) => Promise<ScreenerRow[]>> = {
  top: fetchScreenerTop,
  gainers: fetchScreenerGainers,
  losers: fetchScreenerLosers,
};

export default function ScreenerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("top");
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback((tab: Tab) => {
    setLoading(true);
    setError(false);
    FETCHERS[tab](100)
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab, loadData]);

  const handleTabChange = (tab: Tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Market Screener
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Top tokens, biggest movers, trending, and new listings.
      </p>

      {/* Tab navigation */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 16,
        borderBottom: "1px solid var(--color-border)",
        paddingBottom: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key
                ? "var(--color-brand)"
                : "var(--color-text-secondary)",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key
                ? "2px solid var(--color-brand)"
                : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
      ) : error || rows.length === 0 ? (
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
            gridTemplateColumns: "50px 2fr 1fr 1fr 1fr",
            gap: 16,
            padding: "12px 20px",
            borderBottom: "1px solid var(--color-border)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
          }}>
            <span>#</span>
            <span>Token</span>
            <span style={{ textAlign: "right" }}>Price (ADA)</span>
            <span style={{ textAlign: "right" }}>24h Change</span>
            <span style={{ textAlign: "right" }}>24h Volume</span>
          </div>
          {/* Rows */}
          {rows.map((r) => {
            const change = r.change24h != null ? parseFloat(r.change24h) : null;
            const changeColor = change != null
              ? change >= 0
                ? "var(--color-positive)"
                : "var(--color-negative)"
              : "var(--color-text-muted)";

            return (
              <div
                key={r.asset}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 2fr 1fr 1fr 1fr",
                  gap: 16,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--color-border)",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  transition: "background 0.1s",
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>
                  {r.rank}
                </span>
                <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                  {r.ticker || (r.asset.length > 30
                    ? `${r.asset.slice(0, 12)}...${r.asset.slice(-8)}`
                    : r.asset)}
                </span>
                <span style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>
                  {parseFloat(r.priceAda).toFixed(6)}
                </span>
                <span style={{ textAlign: "right", color: changeColor, fontWeight: 500 }}>
                  {change != null
                    ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
                    : "—"}
                </span>
                <span style={{ textAlign: "right", color: "var(--color-text-muted)" }}>
                  {formatVolume(r.volumeAda)}
                </span>
              </div>
            );
          })}
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
