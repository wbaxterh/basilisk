"use client";

/**
 * TokenChart v2 — DexHunter-class candlestick/line/area chart for a Cardano
 * asset on lightweight-charts v5.
 *
 * Data: /api/v1/tokens/{asset}/ohlcv?tf=…&quote=…&pool=… (GeckoTerminal-
 * backed; candles read from ONE GT-indexed pool — the pool dropdown in the
 * header says exactly which pool/DEX the chart reads from, and the coverage
 * microcopy keeps the "top pool via GeckoTerminal" caveat visible. This is
 * never "total Cardano volume".)
 *
 * Features: 8 timeframes (1m…1W), candles/line/area styles, USD/₳ quote,
 * PRICE/MCAP (legend says FDV — supply is total, not circulating), pool
 * selector, EMA/SMA overlays, log scale, visible-range delta, ~30 s polling
 * ("LIVE · ~30s" — honestly labeled, not tick-level), fullscreen, prefs
 * persisted to localStorage ("basilisk.chart", per-user; pool is not).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  PriceScaleMode,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
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

interface PoolChoice {
  address: string;
  dexId: string;
  name: string;
  reserveUsd: number;
}

interface OhlcvResponse {
  asset: string;
  pool: { address: string; dexId: string; name: string };
  poolChoices?: PoolChoice[];
  tf: string;
  quote: string; // "USD" | "ADA"
  candles: OhlcvCandle[];
  coverage: string;
}

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "12h" | "1d" | "1w";
type ChartStyle = "candles" | "line" | "area";
type QuoteMode = "usd" | "ada";
type PriceMode = "price" | "mcap";
type ScaleMode = "linear" | "log";
type IndicatorId = "ema9" | "ema21" | "sma50" | "sma200";

const TIMEFRAMES: Array<{ id: Timeframe; label: string }> = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "12h", label: "12H" },
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
];

const INDICATOR_DEFS: Array<{
  id: IndicatorId;
  label: string;
  color: string;
  period: number;
  kind: "ema" | "sma";
}> = [
  { id: "ema9", label: "EMA 9", color: "#70ECFD", period: 9, kind: "ema" },
  { id: "ema21", label: "EMA 21", color: "#FFC107", period: 21, kind: "ema" },
  { id: "sma50", label: "SMA 50", color: "#16A35A", period: 50, kind: "sma" },
  { id: "sma200", label: "SMA 200", color: "#6B6B73", period: 200, kind: "sma" },
];

// ---------------------------------------------------------------------------
// Persisted prefs (per-user, NOT per-token; pool intentionally excluded)
// ---------------------------------------------------------------------------

interface ChartPrefs {
  tf: Timeframe;
  style: ChartStyle;
  quote: QuoteMode;
  mode: PriceMode;
  indicators: IndicatorId[];
  scale: ScaleMode;
}

const PREFS_KEY = "basilisk.chart";

const DEFAULT_PREFS: ChartPrefs = {
  tf: "1h",
  style: "candles",
  quote: "usd",
  mode: "price",
  indicators: [],
  scale: "linear",
};

const TF_IDS = new Set(TIMEFRAMES.map((t) => t.id));
const INDICATOR_IDS = new Set(INDICATOR_DEFS.map((d) => d.id));

function loadPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ChartPrefs>;
    return {
      tf: TF_IDS.has(p.tf as Timeframe) ? (p.tf as Timeframe) : DEFAULT_PREFS.tf,
      style: ["candles", "line", "area"].includes(p.style as string)
        ? (p.style as ChartStyle)
        : DEFAULT_PREFS.style,
      quote: p.quote === "ada" ? "ada" : "usd",
      mode: p.mode === "mcap" ? "mcap" : "price",
      indicators: Array.isArray(p.indicators)
        ? (p.indicators.filter((i) => INDICATOR_IDS.has(i as IndicatorId)) as IndicatorId[])
        : [],
      scale: p.scale === "log" ? "log" : "linear",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

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
// Formatting — token prices span $2,000 to $0.0000009; FDV spans to billions
// ---------------------------------------------------------------------------

/** Decimal places by price magnitude (sub-cent tokens need many digits). */
function precisionFor(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 2;
  if (p >= 1000) return 2;
  if (p >= 1) return 3;
  if (p >= 0.01) return 4;
  return Math.min(12, 2 - Math.floor(Math.log10(p)));
}

function fmtWithUnit(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${unit}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `${unit}${n.toFixed(precisionFor(n))}`;
}

/** Compact money: 12.5M, 1.2B — used for FDV values and pool reserves. */
function fmtCompact(n: number | null | undefined, unit = "$"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `${unit}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${unit}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${unit}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${unit}${(n / 1e3).toFixed(1)}K`;
  return `${unit}${n.toFixed(2)}`;
}

function fmtVol(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Indicator math (closes in display units, ascending)
// ---------------------------------------------------------------------------

function smaPoints(candles: OhlcvCandle[], period: number): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time as UTCTimestamp, value: sum / period });
  }
  return out;
}

function emaPoints(candles: OhlcvCandle[], period: number): LineData<Time>[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += candles[i].close;
  let prev = seed / period;
  const out: LineData<Time>[] = [{ time: candles[period - 1].time as UTCTimestamp, value: prev }];
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time as UTCTimestamp, value: prev });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Icons (stroke SVG, never emoji)
// ---------------------------------------------------------------------------

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { flexShrink: 0 },
    "aria-hidden": true as const,
  };
}

function ChartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 6v3M8 15v3M8 9h-2v6h4v-6h-2z" />
      <path d="M16 4v4M16 16v4M16 8h-2v8h4V8h-2z" />
    </svg>
  );
}

function LineIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 17l5-6 4 3 6-8 3 4" />
    </svg>
  );
}

function AreaIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 16l5-5 4 3 6-7 3 3" />
      <path d="M3 20h18" />
    </svg>
  );
}

function FxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M10 4c-2 0-3 1-3 3v10c0 2-1 3-3 3" />
      <path d="M4 10h6" />
      <path d="M13 12l7 8M20 12l-7 8" />
    </svg>
  );
}

function ExpandIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />
    </svg>
  );
}

function CollapseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M20 9h-5V4M4 15h5v5M20 4l-6 6M4 20l6-6" />
    </svg>
  );
}

function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Status = "loading" | "ready" | "empty" | "error";

type MainSeriesRef =
  | { kind: "candles"; api: ISeriesApi<"Candlestick"> }
  | { kind: "line"; api: ISeriesApi<"Line"> }
  | { kind: "area"; api: ISeriesApi<"Area"> };

const LIVE_POLL_MS = 30_000;

export default function TokenChart({ asset, height = 380 }: { asset: string; height?: number }) {
  const [prefs, setPrefs] = useState<ChartPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pool, setPool] = useState<string | null>(null); // NOT persisted
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<OhlcvResponse | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hovered, setHovered] = useState<OhlcvCandle | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [liveCandle, setLiveCandle] = useState<OhlcvCandle | null>(null);
  const [rangeDelta, setRangeDelta] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsFallback, setFsFallback] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"pool" | "indicators" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<MainSeriesRef | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastBarTimeRef = useRef(0);
  const scaleRef = useRef<ScaleMode>(prefs.scale);
  scaleRef.current = prefs.scale;

  const updatePrefs = (patch: Partial<ChartPrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  // MCAP mode is USD-only and needs a supply figure; fall back to price
  // silently rather than charting garbage.
  const effectiveMode: PriceMode =
    prefs.mode === "mcap" && prefs.quote === "usd" && supply != null ? "mcap" : "price";
  const factor = effectiveMode === "mcap" && supply != null ? supply : 1;
  const unitPrefix = data?.quote === "ADA" ? "₳" : "$";
  const fmtVal = (n: number | null | undefined) =>
    effectiveMode === "mcap" ? fmtCompact(n, "$") : fmtWithUnit(n, unitPrefix);

  // -- prefs: load once, persist on change --------------------------------
  useEffect(() => {
    setPrefs(loadPrefs());
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* storage full/blocked — prefs just won't stick */
    }
  }, [prefs, prefsLoaded]);

  // -- reset pool selection when the asset changes ------------------------
  useEffect(() => {
    setPool(null);
  }, [asset]);

  // -- supply for MCAP/FDV (total supply — hence the FDV legend label) ----
  useEffect(() => {
    let cancelled = false;
    setSupply(null);
    fetch(`/api/v1/tokens/${encodeURIComponent(asset.toLowerCase())}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { totalSupply?: string | null; decimals?: number | null } | null) => {
        if (cancelled || !body?.totalSupply) return;
        const decimals = typeof body.decimals === "number" ? body.decimals : 0;
        const s = Number(body.totalSupply) / 10 ** decimals;
        if (Number.isFinite(s) && s > 0) setSupply(s);
      })
      .catch(() => {
        /* MCAP toggle simply stays disabled */
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  // -- fetch candles for the active timeframe/quote/pool ------------------
  useEffect(() => {
    if (!prefsLoaded) return;
    let cancelled = false;
    setStatus("loading");
    setData(null);
    setHovered(null);
    setLiveCandle(null);
    setRangeDelta(null);
    setEmptyHint(null);

    const qs = new URLSearchParams({ tf: prefs.tf, quote: prefs.quote });
    if (pool) qs.set("pool", pool);
    fetch(`/api/v1/tokens/${encodeURIComponent(asset.toLowerCase())}/ohlcv?${qs}`, {
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
  }, [asset, prefs.tf, prefs.quote, pool, attempt, prefsLoaded]);

  // Auto-retry 15 s after a transient failure ("data delayed" state), but
  // stop after a few rounds — a token GT persistently 502s on must not
  // poll upstream forever (the manual "Retry now" button stays available).
  useEffect(() => {
    if (status !== "error" || attempt >= 4) return;
    const timer = setTimeout(() => setAttempt((a) => a + 1), 15_000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  // -- candles in display units (price vs FDV) ----------------------------
  const displayCandles = useMemo<OhlcvCandle[] | null>(() => {
    if (!data) return null;
    if (factor === 1) return data.candles;
    return data.candles.map((c) => ({
      ...c,
      open: c.open * factor,
      high: c.high * factor,
      low: c.low * factor,
      close: c.close * factor,
    }));
  }, [data, factor]);

  const chartH = isFullscreen
    ? Math.max(320, (typeof window !== "undefined" ? window.innerHeight : 800) - 240)
    : height;

  // -- build / tear down the chart -----------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || !displayCandles || displayCandles.length === 0) return;

    const candles = displayCandles;
    const lastClose = candles[candles.length - 1].close;
    const precision = precisionFor(lastClose);
    const isMcap = factor !== 1;
    const unit = data.quote === "ADA" ? "₳" : "$";
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
      rightPriceScale: {
        borderColor: AXIS_BORDER,
        mode: scaleRef.current === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
    });

    const priceFormat = {
      type: "custom" as const,
      formatter: (v: number) => (isMcap ? fmtCompact(v, "$") : fmtWithUnit(v, unit)),
      minMove: isMcap ? Math.max(1, Math.pow(10, Math.floor(Math.log10(lastClose)) - 4)) : Math.pow(10, -precision),
    };

    let main: MainSeriesRef;
    if (prefs.style === "candles") {
      const api = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: false,
        priceFormat,
      });
      api.setData(
        candles.map<CandlestickData<Time>>((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
      main = { kind: "candles", api };
    } else if (prefs.style === "line") {
      const api = chart.addSeries(LineSeries, {
        color: UP,
        lineWidth: 2,
        priceFormat,
      });
      api.setData(
        candles.map<LineData<Time>>((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
      );
      main = { kind: "line", api };
    } else {
      const api = chart.addSeries(AreaSeries, {
        lineColor: UP,
        lineWidth: 2,
        topColor: "rgba(32, 235, 122, 0.25)",
        bottomColor: "rgba(32, 235, 122, 0.02)",
        priceFormat,
      });
      api.setData(
        candles.map<LineData<Time>>((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
      );
      main = { kind: "area", api };
    }

    // Indicator overlays (client-side EMA/SMA over display-unit closes).
    for (const def of INDICATOR_DEFS) {
      if (!prefs.indicators.includes(def.id)) continue;
      const points = def.kind === "ema" ? emaPoints(candles, def.period) : smaPoints(candles, def.period);
      if (points.length === 0) continue;
      const line = chart.addSeries(LineSeries, {
        color: def.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceFormat,
      });
      line.setData(points);
    }

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
    if (volumePane) volumePane.setHeight(Math.max(56, Math.round(chartH * 0.2)));

    chart.timeScale().fitContent();

    // Crosshair → O/H/L/C/Vol legend readout (idle = last candle).
    const byTime = new Map<number, OhlcvCandle>(candles.map((c) => [c.time, c]));
    let disposed = false;
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      if (disposed) return;
      if (typeof param.time !== "number") {
        setHovered(null);
        return;
      }
      setHovered(byTime.get(param.time) ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    // Visible-range delta chip: first vs last visible close, throttled 250ms.
    let latestRange: LogicalRange | null = chart.timeScale().getVisibleLogicalRange();
    let rangeTimer: ReturnType<typeof setTimeout> | null = null;
    const computeDelta = () => {
      rangeTimer = null;
      if (disposed) return;
      const r = latestRange;
      if (!r) {
        setRangeDelta(null);
        return;
      }
      const from = Math.max(0, Math.ceil(r.from));
      const to = Math.min(candles.length - 1, Math.floor(r.to));
      if (to <= from || !(candles[from].close > 0)) {
        setRangeDelta(null);
        return;
      }
      setRangeDelta((candles[to].close / candles[from].close - 1) * 100);
    };
    const onRangeChange = (range: LogicalRange | null) => {
      latestRange = range;
      if (rangeTimer == null) rangeTimer = setTimeout(computeDelta, 250);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    onRangeChange(latestRange);

    chartRef.current = chart;
    mainSeriesRef.current = main;
    volSeriesRef.current = volumeSeries;
    lastBarTimeRef.current = candles[candles.length - 1].time;

    return () => {
      disposed = true;
      if (rangeTimer != null) clearTimeout(rangeTimer);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volSeriesRef.current = null;
      setHovered(null);
    };
  }, [data, displayCandles, factor, prefs.style, prefs.indicators, chartH]);

  // -- log/linear without a rebuild ----------------------------------------
  useEffect(() => {
    chartRef.current?.applyOptions({
      rightPriceScale: {
        mode: prefs.scale === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
    });
  }, [prefs.scale]);

  // -- live polling (~30 s; paused while the tab is hidden) ----------------
  useEffect(() => {
    if (status !== "ready" || !data) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const qs = new URLSearchParams({
          tf: prefs.tf,
          quote: prefs.quote,
          pool: data.pool.address,
          limit: "2",
        });
        const res = await fetch(
          `/api/v1/tokens/${encodeURIComponent(asset.toLowerCase())}/ohlcv?${qs}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as OhlcvResponse | null;
        const last = body?.candles?.[body.candles.length - 1];
        if (cancelled || !last || !Number.isFinite(last.time)) return;
        if (last.time < lastBarTimeRef.current) return; // never update backwards
        const t = last.time as UTCTimestamp;
        const main = mainSeriesRef.current;
        if (main) {
          if (main.kind === "candles") {
            main.api.update({
              time: t,
              open: last.open * factor,
              high: last.high * factor,
              low: last.low * factor,
              close: last.close * factor,
            });
          } else {
            main.api.update({ time: t, value: last.close * factor });
          }
        }
        volSeriesRef.current?.update({
          time: t,
          value: last.volume,
          color: last.close >= last.open ? UP_SOFT : DOWN_SOFT,
        });
        lastBarTimeRef.current = last.time;
        setLiveCandle(last);
      } catch {
        /* transient poll failure — next tick will retry */
      }
    };

    const interval = setInterval(tick, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, data, asset, prefs.tf, prefs.quote, factor]);

  // -- fullscreen -----------------------------------------------------------
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && !fsFallback) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [fsFallback]);

  useEffect(() => {
    if (!(isFullscreen && fsFallback)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        setFsFallback(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen, fsFallback]);

  // Re-fit after the container jumps size on fullscreen toggle.
  useEffect(() => {
    const raf = requestAnimationFrame(() => chartRef.current?.timeScale().fitContent());
    return () => cancelAnimationFrame(raf);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const el = sectionRef.current;
      if (el?.requestFullscreen) {
        el.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => {
            setFsFallback(true);
            setIsFullscreen(true);
          });
      } else {
        setFsFallback(true);
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
      setFsFallback(false);
    }
  };

  // -- dropdown outside-click dismissal ------------------------------------
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  // -- legend ----------------------------------------------------------------
  const liveDisplay = useMemo<OhlcvCandle | null>(() => {
    if (!liveCandle) return null;
    if (factor === 1) return liveCandle;
    return {
      ...liveCandle,
      open: liveCandle.open * factor,
      high: liveCandle.high * factor,
      low: liveCandle.low * factor,
      close: liveCandle.close * factor,
    };
  }, [liveCandle, factor]);

  const legendCandle =
    hovered ?? liveDisplay ?? (displayCandles ? displayCandles[displayCandles.length - 1] : null);

  let closeChangePct: number | null = null;
  if (legendCandle && displayCandles && displayCandles.length > 1) {
    const idx = displayCandles.findIndex((c) => c.time === legendCandle.time);
    const prev =
      idx > 0
        ? displayCandles[idx - 1]
        : idx === -1
          ? displayCandles[displayCandles.length - 1] // live bar appended past the fetched window
          : null;
    if (prev && prev.close > 0) closeChangePct = (legendCandle.close / prev.close - 1) * 100;
  }

  const poolChoices = data?.poolChoices ?? [];
  const mcapDisabled = prefs.quote === "ada" || supply == null;

  return (
    <section
      ref={sectionRef}
      style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: isFullscreen ? 0 : 8,
        padding: "16px 18px",
        minWidth: 0,
        ...(isFullscreen && fsFallback
          ? { position: "fixed" as const, inset: 0, zIndex: 1000, overflow: "auto" }
          : {}),
        ...(isFullscreen ? { background: "#0A0A0B" } : {}),
      }}
    >
      <style>{`@keyframes bslk-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>

      {/* Header: label + pool dropdown + LIVE + range delta + coverage */}
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
            style={{ position: "relative", display: "inline-flex" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen(menuOpen === "pool" ? null : "pool")}
              title={`Candles read from this pool: ${data.pool.address}`}
              aria-haspopup="listbox"
              aria-expanded={menuOpen === "pool"}
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
                cursor: poolChoices.length > 1 ? "pointer" : "default",
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
              {poolChoices.length > 1 ? <ChevronDown /> : null}
            </button>
            {menuOpen === "pool" && poolChoices.length > 0 ? (
              <div
                role="listbox"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  zIndex: 40,
                  minWidth: 260,
                  background: "#111112",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: 4,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                }}
              >
                {poolChoices.map((p) => {
                  const active = p.address === data.pool.address;
                  return (
                    <button
                      key={p.address}
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setMenuOpen(null);
                        if (!active) setPool(p.address);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: active ? "var(--color-brand-soft)" : "transparent",
                        color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ flex: 1 }}>
                        {dexLabel(p.dexId)} · {compactPair(p.name)}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                        }}
                      >
                        {fmtCompact(p.reserveUsd)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </span>
        ) : status === "loading" ? (
          <span className="lp-skeleton" style={{ width: 120, height: 18, borderRadius: 999 }} />
        ) : null}

        {status === "ready" ? (
          <span
            title="Chart refreshes every ~30 seconds while this tab is visible — polled, not tick-level."
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-bg-secondary)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.8,
              color: "var(--color-brand)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--color-brand)",
                animation: "bslk-live-pulse 2s ease-in-out infinite",
              }}
            />
            LIVE · ~30S
          </span>
        ) : null}

        {rangeDelta != null && status === "ready" ? (
          <span
            title="Close-to-close change across the candles currently in view"
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-bg-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              color: rangeDelta >= 0 ? "var(--color-positive)" : "var(--color-negative)",
              whiteSpace: "nowrap",
            }}
          >
            {rangeDelta >= 0 ? "+" : ""}
            {rangeDelta.toFixed(1)}% in view
          </span>
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

      {/* Controls: tf pills · style · quote · mode · scale · fx · fullscreen */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        {TIMEFRAMES.map((t) => (
          <Pill
            key={t.id}
            active={t.id === prefs.tf}
            onClick={() => updatePrefs({ tf: t.id })}
          >
            {t.label}
          </Pill>
        ))}

        <Divider />

        <Pill
          active={prefs.style === "candles"}
          onClick={() => updatePrefs({ style: "candles" })}
          title="Candlesticks"
          ariaLabel="Candlestick style"
        >
          <ChartIcon size={13} />
        </Pill>
        <Pill
          active={prefs.style === "line"}
          onClick={() => updatePrefs({ style: "line" })}
          title="Line (closes)"
          ariaLabel="Line style"
        >
          <LineIcon />
        </Pill>
        <Pill
          active={prefs.style === "area"}
          onClick={() => updatePrefs({ style: "area" })}
          title="Area (closes)"
          ariaLabel="Area style"
        >
          <AreaIcon />
        </Pill>

        <Divider />

        <Pill
          active={prefs.quote === "usd"}
          onClick={() => updatePrefs({ quote: "usd" })}
          title="Quote candles in US dollars"
        >
          USD
        </Pill>
        <Pill
          active={prefs.quote === "ada"}
          onClick={() => updatePrefs({ quote: "ada", mode: "price" })}
          title="Quote candles in ADA (pool quote token)"
        >
          ₳
        </Pill>

        <Divider />

        <Pill
          active={effectiveMode === "price"}
          onClick={() => updatePrefs({ mode: "price" })}
          title="Chart the token price"
        >
          PRICE
        </Pill>
        <Pill
          active={effectiveMode === "mcap"}
          disabled={mcapDisabled}
          onClick={() => updatePrefs({ mode: "mcap" })}
          title={
            prefs.quote === "ada"
              ? "MCAP is USD-only — switch the quote to USD first"
              : supply == null
                ? "Total supply unavailable for this asset"
                : "Chart price × total supply (FDV)"
          }
        >
          MCAP
        </Pill>

        <Divider />

        <Pill
          active={prefs.scale === "log"}
          onClick={() => updatePrefs({ scale: prefs.scale === "log" ? "linear" : "log" })}
          title="Toggle logarithmic price scale"
        >
          LOG
        </Pill>

        <span
          style={{ position: "relative", display: "inline-flex" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Pill
            active={prefs.indicators.length > 0 || menuOpen === "indicators"}
            onClick={() => setMenuOpen(menuOpen === "indicators" ? null : "indicators")}
            title="Indicators (EMA/SMA overlays)"
            ariaLabel="Indicators menu"
          >
            <FxIcon />
          </Pill>
          {menuOpen === "indicators" ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 40,
                minWidth: 170,
                background: "#111112",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
              }}
            >
              {INDICATOR_DEFS.map((def) => {
                const active = prefs.indicators.includes(def.id);
                return (
                  <button
                    key={def.id}
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        indicators: p.indicators.includes(def.id)
                          ? p.indicators.filter((i) => i !== def.id)
                          : [...p.indicators, def.id],
                      }))
                    }
                    aria-pressed={active}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: active ? "var(--color-brand-soft)" : "transparent",
                      color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 2,
                        borderRadius: 1,
                        background: def.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontFamily: "var(--font-mono)" }}>{def.label}</span>
                    {active ? <span style={{ fontSize: 10 }}>ON</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </span>

        <Pill
          active={isFullscreen}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          ariaLabel={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
        </Pill>
      </div>

      {/* OHLC legend + active indicator chips */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
        }}
      >
        {effectiveMode === "mcap" ? (
          <span
            title="Price × TOTAL supply — fully diluted value, not circulating market cap"
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.8,
              padding: "2px 7px",
              borderRadius: 999,
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-bg-secondary)",
              color: "var(--color-warning, #FFC107)",
              fontFamily: "var(--font-sans)",
            }}
          >
            FDV
          </span>
        ) : null}
        <LegendItem label="O" value={fmtVal(legendCandle?.open)} />
        <LegendItem label="H" value={fmtVal(legendCandle?.high)} />
        <LegendItem label="L" value={fmtVal(legendCandle?.low)} />
        <LegendItem
          label="C"
          value={fmtVal(legendCandle?.close)}
          color={
            legendCandle
              ? legendCandle.close >= legendCandle.open
                ? "var(--color-positive)"
                : "var(--color-negative)"
              : undefined
          }
        />
        {closeChangePct != null ? (
          <span
            title="Close change vs the previous candle"
            style={{
              fontWeight: 700,
              fontSize: 11,
              color: closeChangePct >= 0 ? "var(--color-positive)" : "var(--color-negative)",
              whiteSpace: "nowrap",
            }}
          >
            {closeChangePct >= 0 ? "+" : ""}
            {closeChangePct.toFixed(2)}%
          </span>
        ) : null}
        <LegendItem label="Vol" value={fmtVol(legendCandle?.volume)} />
        {INDICATOR_DEFS.filter((d) => prefs.indicators.includes(d.id)).map((d) => (
          <span
            key={d.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              color: d.color,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 9, height: 2, borderRadius: 1, background: d.color }} />
            {d.label}
          </span>
        ))}
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
          <div ref={containerRef} style={{ width: "100%", height: chartH }} />
        ) : status === "loading" ? (
          <div style={{ padding: 10 }} aria-busy="true" aria-label="Loading chart">
            <span
              className="lp-skeleton"
              style={{ display: "block", width: "100%", height: chartH - 20, borderRadius: 4 }}
            />
          </div>
        ) : status === "empty" ? (
          <StateBlock
            height={chartH}
            title="Chart unavailable — no indexed pool yet"
            sub={
              emptyHint ??
              "GeckoTerminal has no indexed pool for this asset. Charts read the top pool's candles, so there is nothing to draw yet."
            }
          />
        ) : (
          <StateBlock
            height={chartH}
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
        Candles read from the single selected GeckoTerminal-indexed pool — not aggregate Cardano
        volume. Volume bars are always USD.{" "}
        {effectiveMode === "mcap"
          ? "MCAP mode multiplies price by TOTAL supply (FDV), not circulating supply. "
          : ""}
        Updates poll every ~30 seconds — not tick-level.
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Control + legend + state atoms
// ---------------------------------------------------------------------------

function Pill({
  active,
  disabled,
  onClick,
  title,
  ariaLabel,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "4px 10px",
        minHeight: 26,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        letterSpacing: 0.3,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        background: active ? "var(--color-brand-soft)" : "var(--color-bg-secondary)",
        color: active ? "var(--color-brand)" : "var(--color-text-muted)",
        border: `1px solid ${active ? "var(--color-brand-dim)" : "var(--color-border-soft)"}`,
        transition: "color 120ms, background 120ms, border-color 120ms",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 18, background: "var(--color-border-soft)", flexShrink: 0 }}
    />
  );
}

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
