"use client";

import { useState, useCallback } from "react";
import EmptyState from "../../components/EmptyState";
import { fetchWalletHoldings, trackWallet } from "../../lib/api";

interface Holding {
  asset: string;
  quantity: string;
  valueAda: string;
  valueUsd: string | null;
  avgCostAda: string | null;
}

export default function PortfolioPage() {
  const [stakeInput, setStakeInput] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tracked, setTracked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState("");

  const handleLookup = useCallback(async () => {
    const addr = stakeInput.trim();
    if (!addr) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetchWalletHoldings(addr);
      setHoldings(res.data);
      setTracked(res.meta.tracked);
      setCurrentAddress(addr);
    } catch {
      setError("Could not load holdings. Is the API gateway running?");
    } finally {
      setLoading(false);
    }
  }, [stakeInput]);

  const handleTrack = async () => {
    if (!currentAddress) return;
    try {
      await trackWallet(currentAddress);
      setTracked(true);
    } catch {
      setError("Failed to track wallet.");
    }
  };

  const totalAda = holdings.reduce((sum, h) => sum + parseFloat(h.valueAda || "0"), 0);

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Portfolio
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Track your wallet holdings, net worth, and P&amp;L over time.
      </p>

      {/* Wallet lookup */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Enter stake address (stake1u...) or payment address..."
          value={stakeInput}
          onChange={(e) => setStakeInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-primary)",
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />
        <button
          onClick={handleLookup}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-brand)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading..." : "Look Up"}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "rgba(239, 68, 68, 0.1)",
          color: "var(--color-negative)",
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {!currentAddress ? (
        <EmptyState
          icon="💼"
          title="No wallets tracked"
          description="Enter a Cardano stake address or payment address above to see holdings, value, and P&L."
        />
      ) : (
        <>
          {/* Summary bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 }}>
                Total Value
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {formatAda(totalAda)} ADA
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-muted)",
              }}>
                {currentAddress.slice(0, 12)}...{currentAddress.slice(-6)}
              </span>
              {!tracked && (
                <button
                  onClick={handleTrack}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(45, 182, 124, 0.1)",
                    color: "var(--color-brand)",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "1px solid var(--color-brand)",
                  }}
                >
                  Track Wallet
                </button>
              )}
              {tracked && (
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(45, 182, 124, 0.1)",
                  color: "var(--color-brand)",
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  Tracked
                </span>
              )}
            </div>
          </div>

          {/* Holdings table */}
          <div style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
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
              <span style={{ textAlign: "right" }}>Quantity</span>
              <span style={{ textAlign: "right" }}>Value (ADA)</span>
            </div>

            {holdings.length === 0 ? (
              <div style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 14,
              }}>
                No holdings found for this address.
              </div>
            ) : (
              holdings
                .sort((a, b) => parseFloat(b.valueAda) - parseFloat(a.valueAda))
                .map((h) => (
                  <div
                    key={h.asset}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr",
                      gap: 16,
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      color: h.asset === "lovelace" ? "var(--color-brand)" : "var(--color-text-primary)",
                      fontWeight: h.asset === "lovelace" ? 600 : 400,
                    }}>
                      {h.asset === "lovelace"
                        ? "ADA"
                        : h.asset.length > 30
                          ? `${h.asset.slice(0, 12)}...${h.asset.slice(-8)}`
                          : h.asset}
                    </span>
                    <span style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-secondary)",
                    }}>
                      {h.asset === "lovelace"
                        ? formatAda(Number(h.quantity) / 1_000_000)
                        : Number(h.quantity).toLocaleString()}
                    </span>
                    <span style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-secondary)",
                    }}>
                      {formatAda(parseFloat(h.valueAda))}
                    </span>
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(2)}K`;
  return ada.toFixed(2);
}
