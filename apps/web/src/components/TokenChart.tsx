"use client";

/**
 * TokenChart — candlestick + volume chart for a Cardano asset.
 *
 * Data: /api/v1/tokens/{asset}/ohlcv?tf=… (GeckoTerminal-backed; candles are
 * USD-denominated and read from the token's TOP GT-indexed pool — the pool
 * chip in the header says exactly which pool/DEX the chart reads from, and
 * the coverage microcopy keeps the "top pool via GeckoTerminal" caveat
 * visible. This is never "total Cardano volume".)
 *
 * lightweight-charts v5: createChart + addSeries(CandlestickSeries) and
 * addSeries(HistogramSeries, …, paneIndex 1) for the volume pane.
 */

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type CandlestickData,
  type HistogramData,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

// ---------------------------------------------------------------------------
// Data contract (mirrors /api/v1/tokens/[asset]/ohlcv)
// ---------------------------------------------------------------------------

interface OhlcvCandle {
  /** Unix seconds (UTC), ascending. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** USD volume for the bucket. */
  volume: number;
}

interface OhlcvResponse {
  asset: string;
  pool: { address: string; dexId: string; name: string };
  tf: string;
  quote: string;
  candles: OhlcvCandle[];
  coverage: string;
}

type Timeframe = "15m" | "1h" | "4h" | "1d";

const TIMEFRAMES: Array<{ id: Timeframe; label: string }> = [
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];

// ---------------------------------------------------------------------------
// Palette (canvas can't read CSS vars — hexes mirror globals.css tokens)
// ---------------------------------------------------------------------------

const UP = "#20EB7A";
const DOWN = "#FF422B";
const UP_SOFT = "rgba(32, 235, 122, 0.4)";
const DOWN_SOFT = "rgba(255, 66, 43, 0.4)";
const GRID = "#1A1A20";
const AXIS_BORDER = "#24242C";
const CROSSHAIR = "#2F2F38";
const CHART_TEXT = "#6B6B73";

const DEX_LABELS: Record<string, string> = {
  sundaeswap: "SundaeSwap",
  wingriders: "WingRiders",
  minswap: "Minswap",
  muesliswap: "MuesliSwap",
  saturnswap: "SaturnSwap",
};

function dexLabel(id: string): string {
  return DEX_LABELS[id.toLowerCase()] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** "SNEK / ADA" → "SNEK/ADA" for the compact pool chip. */
function compactPair(name: string): string {
  return name.replace(/\s*\/\s*/g, "/");
}

// ---------------------------------------------------------------------------
// Formatting — token prices span $2,000 to $0.0000009
// ---------------------------------------------------------------------------

/** Decimal places by price magnitude (sub-cent tokens need many digits). */
function precisionFor(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 2;
  if (p >= 1000) return 2;
  if (p >= 1) return 3;
  if (p >= 0.01) return 4;
  return Math.min(12, 2 - Math.floor(Math.log10(p)));
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(precisionFor(n))}`;
}

function fmtVol(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Icon (stroke SVG, never emoji)
// ---------------------------------------------------------------------------

function ChartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M8 6v3M8 15v3M8 9h-2v6h4v-6h-2z" />
      <path d="M16 4v4M16 16v4M16 8h-2v8h4V8h-2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Status = "loading" | "ready" | "empty" | "error";

export default function TokenChart({ asset, height = 380 }: { asset: string; height?: number }) {
  const [tf, setTf] = useState<Timeframe>("1h");
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<OhlcvResponse | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hovered, setHovered] = useState<OhlcvCandle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch candles for the active timeframe.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);
    setHovered(null);
    setEmptyHint(null);

    fetch(`/api/v1/tokens/${encodeURIComponent(asset.toLowerCase())}/ohlcv?tf=${tf}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | (OhlcvResponse & { error?: string; hint?: string })
          | null;
        if (cancelled) return;
        if (res.status === 404) {
          setEmptyHint(body?.hint ?? null);
          setStatus("empty");
          return;
        }
        if (!res.ok || !body || !Array.isArray(body.candles) || body.candles.length === 0) {
          setStatus("error");
          return;
        }
        setData(body);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [asset, tf, attempt]);

  // Auto-retry 15 s after a transient failure ("data delayed" state), but
  // stop after a few rounds — a token GT persistently 502s on must not
  // poll upstream forever (the manual "Retry now" button stays available).
  useEffect(() => {
    if (status !== "error" || attempt >= 4) return;
    const timer = setTimeout(() => setAttempt((a) => a + 1), 15_000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  // Build / tear down the chart whenever a fresh candle set arrives.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.candles.length === 0) return;

    const candles = data.candles;
    const lastClose = candles[candles.length - 1].close;
    const precision = precisionFor(lastClose);
    const monoFont =
      getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() ||
      "'JetBrains Mono', 'SF Mono', Menlo, monospace";

    const chart = createChart(container, {
      autoSize: true, // ResizeObserver-backed; tracks the container box
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: CHART_TEXT,
        fontSize: 11,
        fontFamily: monoFont,
        panes: {
          separatorColor: GRID,
          separatorHoverColor: "rgba(47, 47, 56, 0.35)",
          enableResize: false,
        },
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        vertLine: { color: CROSSHAIR, width: 1, style: 3, labelBackgroundColor: "#1A1A1D" },
        horzLine: { color: CROSSHAIR, width: 1, style: 3, labelBackgroundColor: "#1A1A1D" },
      },
      timeScale: {
        borderColor: AXIS_BORDER,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: AXIS_BORDER },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceFormat: { type: "price", precision, minMove: Math.pow(10, -precision) },
    });
    candleSeries.setData(
      candles.map<CandlestickData<Time>>((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // Volume histogram in its own bottom pane, tinted by candle direction.
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1
    );
    volumeSeries.setData(
      candles.map<HistogramData<Time>>((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? UP_SOFT : DOWN_SOFT,
      }))
    );
    volumeSeries.priceScale().applyOptions({
      borderColor: AXIS_BORDER,
      scaleMargins: { top: 0.2, bottom: 0 },
    });
    const volumePane = chart.panes()[1];
    if (volumePane) volumePane.setHeight(Math.max(56, Math.round(height * 0.2)));

    chart.timeScale().fitContent();

    // Crosshair → O/H/L/C/Vol legend readout (idle = last candle).
    const byTime = new Map<number, OhlcvCandle>(candles.map((c) => [c.time, c]));
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      if (typeof param.time !== "number") {
        setHovered(null);
        return;
      }
      setHovered(byTime.get(param.time) ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      setHovered(null);
    };
  }, [data, height]);

  const legendCandle = hovered ?? (data ? data.candles[data.candles.length - 1] : null);

  return (
    <section
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "16px 18px",
        minWidth: 0,
      }}
    >
      {/* Header: label + pool chip + coverage microcopy */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          Price Chart
        </span>
        {data ? (
          <span
            title={`Candles read from this pool: ${data.pool.address}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 9px",
              borderRadius: 999,
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-bg-secondary)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--color-brand)",
                flexShrink: 0,
              }}
            />
            {dexLabel(data.pool.dexId)} · {compactPair(data.pool.name)}
          </span>
        ) : status === "loading" ? (
          <span className="lp-skeleton" style={{ width: 120, height: 18, borderRadius: 999 }} />
        ) : null}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            letterSpacing: 0.4,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          top pool via GeckoTerminal
        </span>
      </div>

      {/* Timeframe pills + OHLC legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {TIMEFRAMES.map((t) => {
          const active = t.id === tf;
          return (
            <button
              key={t.id}
              onClick={() => setTf(t.id)}
              aria-pressed={active}
              style={{
                padding: "4px 11px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                letterSpacing: 0.3,
                cursor: "pointer",
                background: active ? "var(--color-brand-soft)" : "var(--color-bg-secondary)",
                color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                border: `1px solid ${active ? "var(--color-brand-dim)" : "var(--color-border-soft)"}`,
                transition: "color 120ms, background 120ms, border-color 120ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
        >
          <LegendItem label="O" value={fmtPrice(legendCandle?.open)} />
          <LegendItem label="H" value={fmtPrice(legendCandle?.high)} />
          <LegendItem label="L" value={fmtPrice(legendCandle?.low)} />
          <LegendItem
            label="C"
            value={fmtPrice(legendCandle?.close)}
            color={
              legendCandle
                ? legendCandle.close >= legendCandle.open
                  ? "var(--color-positive)"
                  : "var(--color-negative)"
                : undefined
            }
          />
          <LegendItem label="Vol" value={fmtVol(legendCandle?.volume)} />
        </div>
      </div>

      {/* Chart / skeleton / empty / delayed */}
      <div
        style={{
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-soft)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {status === "ready" && data ? (
          <div ref={containerRef} style={{ width: "100%", height }} />
        ) : status === "loading" ? (
          <div style={{ padding: 10 }} aria-busy="true" aria-label="Loading chart">
            <span
              className="lp-skeleton"
              style={{ display: "block", width: "100%", height: height - 20, borderRadius: 4 }}
            />
          </div>
        ) : status === "empty" ? (
          <StateBlock
            height={height}
            title="Chart unavailable — no indexed pool yet"
            sub={
              emptyHint ??
              "GeckoTerminal has no indexed pool for this asset. Charts read the top pool's candles, so there is nothing to draw yet."
            }
          />
        ) : (
          <StateBlock
            height={height}
            title="data delayed — retrying"
            sub="Upstream candles didn't answer in time. Retrying automatically in 15 seconds — nothing is broken on your end."
            action={
              <button
                onClick={() => setAttempt((a) => a + 1)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "var(--color-brand)",
                  color: "#001A0E",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Retry now
              </button>
            }
          />
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 10.5,
          lineHeight: 1.5,
          letterSpacing: 0.3,
          color: "var(--color-text-muted)",
        }}
      >
        Candles are USD-denominated and read from the single deepest GeckoTerminal-indexed pool —
        not aggregate Cardano volume.
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Legend + state atoms
// ---------------------------------------------------------------------------

function LegendItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 700, color: color ?? "var(--color-text-secondary)" }}>{value}</span>
    </span>
  );
}

function StateBlock({
  height,
  title,
  sub,
  action,
}: {
  height: number;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "24px 20px",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <ChartIcon />
      </span>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>{title}</div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--color-text-muted)",
          maxWidth: 380,
          lineHeight: 1.55,
        }}
      >
        {sub}
      </div>
      {action}
    </div>
  );
}
