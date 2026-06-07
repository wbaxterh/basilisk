"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CandleChart from "../../components/CandleChart";
import EmptyState from "../../components/EmptyState";
import { fetchCandles, fetchSwaps, fetchTokens } from "../../lib/api";

interface CandleData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeAda: string;
}

interface SwapData {
  txHash: string;
  dex: string;
  assetIn: string;
  amountIn: string;
  assetOut: string;
  amountOut: string;
  timestamp: number;
}

interface TokenResult {
  asset: string;
  ticker: string | null;
  name: string | null;
}

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export default function TokensPage() {
  const router = useRouter();
  const [asset, setAsset] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<TokenResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [interval, setInterval] = useState<string>("1h");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [swaps, setSwaps] = useState<SwapData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search tokens as user types
  useEffect(() => {
    if (searchInput.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const tokens = await fetchTokens(searchInput.trim());
        setSearchResults(tokens.map((t) => ({ asset: t.asset, ticker: t.ticker, name: t.name })));
        setShowResults(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const loadData = useCallback(async (tokenAsset: string, candleInterval: string) => {
    setLoading(true);
    setError(null);
    try {
      const [candleData, swapData] = await Promise.all([
        fetchCandles(tokenAsset, candleInterval, 168),
        fetchSwaps(tokenAsset, 20),
      ]);
      setCandles(candleData);
      setSwaps(swapData);
    } catch {
      setError("Could not load data. Is the API gateway running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (asset) {
      loadData(asset, interval);
    }
  }, [asset, interval, loadData]);

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (trimmed) {
      setAsset(trimmed);
      setShowResults(false);
    }
  };

  const handleSelectToken = (tokenAsset: string) => {
    setShowResults(false);
    setSearchInput("");
    router.push(`/tokens/${encodeURIComponent(tokenAsset)}`);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Token Charts
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Live prices, OHLCV candles, and trade history for Cardano native tokens.
      </p>

      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search by ticker or name, or enter asset ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
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
            onClick={handleSearch}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-brand)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              border: "none",
            }}
          >
            Load Chart
          </button>
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 72,
            marginTop: 4,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            maxHeight: 240,
            overflowY: "auto",
            zIndex: 50,
          }}>
            {searchResults.map((t) => (
              <button
                key={t.asset}
                onMouseDown={() => handleSelectToken(t.asset)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", minWidth: 60 }}>
                  {t.ticker || "—"}
                </span>
                <span style={{ color: "var(--color-text-secondary)", flex: 1 }}>
                  {t.name || t.asset.slice(0, 20) + "..."}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!asset ? (
        <EmptyState
          icon="📈"
          title="Search for a token"
          description="Enter a token asset ID to view live charts with candlestick data, recent trades, and market statistics."
        />
      ) : (
        <>
          {/* Link to detail page */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => router.push(`/tokens/${encodeURIComponent(asset)}`)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-brand)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View full token details →
            </button>
          </div>

          {/* Interval selector */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  fontWeight: interval === iv ? 600 : 400,
                  background: interval === iv ? "var(--color-brand)" : "var(--color-bg-elevated)",
                  color: interval === iv ? "#fff" : "var(--color-text-secondary)",
                  border: interval === iv ? "none" : "1px solid var(--color-border)",
                  cursor: "pointer",
                }}
              >
                {iv}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: 16,
            marginBottom: 16,
          }}>
            {loading ? (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
                Loading chart data...
              </div>
            ) : error ? (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-negative)" }}>
                {error}
              </div>
            ) : candles.length === 0 ? (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
                No candle data available for this token.
              </div>
            ) : (
              <CandleChart data={candles} height={400} />
            )}
          </div>

          {/* Recent trades */}
          <div style={{
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            padding: 20,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Recent Trades
            </h2>
            {swaps.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
                No recent trades found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 100px 120px",
                  gap: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase" as const,
                  letterSpacing: 0.5,
                }}>
                  <span>Type</span>
                  <span>Amount</span>
                  <span>Price</span>
                  <span>DEX</span>
                  <span>Time</span>
                </div>
                {swaps.map((swap, i) => {
                  const isBuy = swap.assetOut === asset;
                  return (
                    <div
                      key={`${swap.txHash}-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 100px 120px",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-bg-hover)",
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <span style={{ color: isBuy ? "var(--color-positive)" : "var(--color-negative)", fontWeight: 600 }}>
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {isBuy ? swap.amountOut : swap.amountIn}
                      </span>
                      <span style={{ color: "var(--color-text-secondary)" }}>
                        {isBuy ? swap.amountIn : swap.amountOut}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {swap.dex}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {new Date(swap.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
