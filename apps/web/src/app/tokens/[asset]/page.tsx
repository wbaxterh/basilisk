"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import CandleChart from "../../../components/CandleChart";
import { fetchToken, fetchCandles, fetchSwaps } from "../../../lib/api";

interface TokenDetail {
  asset: string;
  policyId: string;
  assetName: string;
  ticker: string | null;
  name: string | null;
  decimals: number;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  updatedAt: number;
  price: {
    priceAda: string;
    priceUsd: string | null;
    volumeAda: string;
    timestamp: number;
  } | null;
  changePercent24h: number | null;
  volume24h: string;
  holders: number;
  totalSupply: string | null;
}

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

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

function formatNumber(value: string | number, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(decimals) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(decimals) + "K";
  return num.toFixed(decimals);
}

function truncateMiddle(str: string, startLen = 8, endLen = 8): string {
  if (str.length <= startLen + endLen + 3) return str;
  return str.slice(0, startLen) + "..." + str.slice(-endLen);
}

export default function TokenDetailPage() {
  const params = useParams();
  const asset = params.asset as string;

  const [token, setToken] = useState<TokenDetail | null>(null);
  const [interval, setInterval] = useState<string>("1h");
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [swaps, setSwaps] = useState<SwapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarketData = useCallback(async (tokenAsset: string, candleInterval: string) => {
    try {
      const [candleData, swapData] = await Promise.all([
        fetchCandles(tokenAsset, candleInterval, 168),
        fetchSwaps(tokenAsset, 20),
      ]);
      setCandles(candleData);
      setSwaps(swapData);
    } catch {
      // candle/swap errors are non-fatal; token info still shows
    }
  }, []);

  useEffect(() => {
    if (!asset) return;
    setLoading(true);
    setError(null);
    fetchToken(decodeURIComponent(asset))
      .then((data) => {
        if (!data) {
          setError("Token not found.");
          return;
        }
        setToken(data as TokenDetail);
        return loadMarketData(decodeURIComponent(asset), interval);
      })
      .catch(() => setError("Could not load token data. Is the API gateway running?"))
      .finally(() => setLoading(false));
  }, [asset, loadMarketData, interval]);

  useEffect(() => {
    if (token) {
      loadMarketData(decodeURIComponent(asset), interval);
    }
  }, [interval, asset, token, loadMarketData]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading token data...
      </div>
    );
  }

  if (error || !token) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-negative)" }}>
        {error || "Token not found."}
      </div>
    );
  }

  const priceAda = token.price ? parseFloat(token.price.priceAda) : null;
  const priceUsd = token.price?.priceUsd ? parseFloat(token.price.priceUsd) : null;
  const change = token.changePercent24h;
  const isPositive = change !== null && change >= 0;

  return (
    <div>
      {/* Header: Token name + live price */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
              {token.ticker || token.name || truncateMiddle(token.asset)}
            </h1>
            {token.ticker && token.name && (
              <span style={{ fontSize: 14, color: "var(--color-text-muted)", fontWeight: 400 }}>
                {token.name}
              </span>
            )}
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>
            Live price and market data
          </p>
        </div>

        {/* Price display */}
        <div style={{ textAlign: "right" }}>
          {priceAda !== null ? (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700 }}>
                {priceAda < 0.01 ? priceAda.toFixed(6) : priceAda.toFixed(4)} <span style={{ fontSize: 16, color: "var(--color-text-muted)", fontWeight: 400 }}>ADA</span>
              </div>
              {priceUsd !== null && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                  ${priceUsd < 0.01 ? priceUsd.toFixed(6) : priceUsd.toFixed(4)} USD
                </div>
              )}
              {change !== null && (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  background: isPositive ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: isPositive ? "var(--color-positive)" : "var(--color-negative)",
                }}>
                  {isPositive ? "\u25B2" : "\u25BC"} {Math.abs(change).toFixed(2)}%
                </div>
              )}
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--color-text-muted)" }}>
              No price data
            </div>
          )}
        </div>
      </div>

      {/* Info + Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Token Info Panel */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, marginTop: 0 }}>
            Token Info
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <InfoRow label="Ticker" value={token.ticker || "—"} mono />
            <InfoRow label="Name" value={token.name || "—"} />
            <InfoRow label="Policy ID" value={truncateMiddle(token.policyId, 12, 12)} mono title={token.policyId} />
            <InfoRow label="Decimals" value={String(token.decimals)} mono />
            {token.description && (
              <div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {token.description}
                </div>
              </div>
            )}
            {token.website && (
              <InfoRow label="Website" value={token.website} link />
            )}
          </div>
        </div>

        {/* Market Stats Panel */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16, marginTop: 0 }}>
            Market Stats
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatCard
              label="24h Volume"
              value={`${formatNumber(token.volume24h)} ADA`}
            />
            <StatCard
              label="24h Change"
              value={change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
              color={change !== null ? (change >= 0 ? "var(--color-positive)" : "var(--color-negative)") : undefined}
            />
            <StatCard
              label="Unique Traders"
              value={formatNumber(token.holders, 0)}
            />
            <StatCard
              label="Total Supply"
              value={token.totalSupply ? formatNumber(token.totalSupply, 0) : "—"}
            />
          </div>
        </div>
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
        {candles.length === 0 ? (
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
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
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
              const decodedAsset = decodeURIComponent(asset);
              const isBuy = swap.assetOut === decodedAsset;
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
    </div>
  );
}

function InfoRow({ label, value, mono, link, title }: { label: string; value: string; mono?: boolean; link?: boolean; title?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{label}</span>
      {link ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--color-brand)", textDecoration: "none", fontFamily: mono ? "var(--font-mono)" : undefined }}
          title={title}
        >
          {value}
        </a>
      ) : (
        <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined }} title={title}>
          {value}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: "var(--color-bg-hover)",
      borderRadius: "var(--radius-md)",
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-mono)", color: color || "var(--color-text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
