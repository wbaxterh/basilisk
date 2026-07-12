/**
 * GeckoTerminal data layer — Minswap coverage + pool OHLCV candles.
 *
 * NOT for the browser: server-side only, module-scope TTL cache with
 * serve-stale-on-error (same idioms as dex-data.ts; helpers copied locally
 * because dex-data does not export them and importing it here would create
 * a cycle — dex-data imports this module for the Minswap merge).
 *
 * Coverage facts (VERIFIED 2026-07-06):
 * - GT network id "cardano" lists exactly one dex: "minswap-cardano"
 *   (GET /networks/cardano/dexes) — but token pool lists ALSO surface a few
 *   "saturnswap" pools (SNEK/ADA saturnswap, $83k reserve, seen today), so
 *   GT's real Cardano coverage is Minswap (dominant) + SaturnSwap. No
 *   SundaeSwap/WingRiders pools observed, so merging GT numbers on top of
 *   DexScreener (Sundae + WingRiders) does not double count.
 * - Pool "id" comes prefixed "cardano_<hex>"; the ohlcv path takes the
 *   UNPREFIXED attributes.address hex.
 * - OHLCV prices AND volume are denominated in USD (candle close matches
 *   base_token_price_usd, not the ADA-quoted price), even when meta.quote
 *   is ADA. The `quote` field below reports "USD" accordingly.
 *
 * Upstream budget: GT public API docs (docs/v2/swagger.json, read today)
 * state "approximately 10 calls/minute, which may fluctuate". Endpoints are
 * themselves cached 1 min upstream. TTLs here are sized so steady-state
 * traffic stays well under that:
 * - token pools: 180 s per token
 * - tokens/multi: 300 s per 30-token chunk (screener merge = 2 chunks / 5 min)
 * - ohlcv: per-tf TTLs (30 s for 1m/5m … 600 s for 1d/1w) per pool+tf+currency
 */

const GT_BASE = "https://api.geckoterminal.com/api/v2";
const GT_VERSION_HEADER = "application/json;version=20230203";

// ---------------------------------------------------------------------------
// Cache: bounded module-scope Map with TTL + serve-stale + in-flight dedupe
// (local copy of the dex-data.ts pattern)
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 500;

function setCache(key: string, value: unknown, ttlMs: number): void {
  if (cacheStore.size >= MAX_CACHE_ENTRIES && !cacheStore.has(key)) {
    const now = Date.now();
    for (const [k, entry] of cacheStore) {
      if (entry.expiresAt <= now) cacheStore.delete(k);
      if (cacheStore.size < MAX_CACHE_ENTRIES) break;
    }
    while (cacheStore.size >= MAX_CACHE_ENTRIES) {
      const oldest = cacheStore.keys().next().value;
      if (oldest == null) break;
      cacheStore.delete(oldest);
    }
  }
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Sentinel so short-lived upstream failures replay instead of re-fetching. */
class CachedFailure {
  constructor(public error: unknown) {}
}
const NEGATIVE_TTL = 45_000;

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheStore.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    if (hit.value instanceof CachedFailure) throw hit.value.error;
    return hit.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await load();
      setCache(key, value, ttlMs);
      return value;
    } catch (err) {
      // Serve stale on upstream failure (rate limit, timeout) if we have
      // anything at all — GT's ~10 req/min free tier makes this essential.
      if (hit && !(hit.value instanceof CachedFailure)) return hit.value as T;
      // Negative-cache the failure briefly so a burst of requests for an
      // uncached key can't hammer GT while it is erroring/rate-limited.
      setCache(key, new CachedFailure(err), NEGATIVE_TTL);
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

const TTL = {
  tokenPools: 180_000,
  tokensMulti: 300_000,
} as const;

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function gtFetch<T>(path: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GT_BASE}${path}`, {
      headers: { Accept: GT_VERSION_HEADER },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GeckoTerminal ${path} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

/** "cardano_f5808c..." → "f5808c..." (ohlcv path takes the bare hex). */
function stripNetworkPrefix(id: string): string {
  return id.startsWith("cardano_") ? id.slice("cardano_".length) : id;
}

/** "minswap-cardano" → "minswap" (aligns with DexScreener-style dex ids). */
function normalizeDexId(id: string): string {
  return id.replace(/-cardano$/, "");
}

// ---------------------------------------------------------------------------
// GT raw types
// ---------------------------------------------------------------------------

interface GtPoolRaw {
  id: string;
  attributes: {
    address: string;
    name: string; // "SNEK / ADA"
    base_token_price_usd?: string | null;
    reserve_in_usd?: string | null;
    volume_usd?: { h24?: string | null };
    price_change_percentage?: { h24?: string | null };
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    dex?: { data?: { id: string } };
  };
}

interface GtTokenRaw {
  id: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    price_usd?: string | null;
    total_reserve_in_usd?: string | null;
    volume_usd?: { h24?: string | null };
    market_cap_usd?: string | null;
    fdv_usd?: string | null;
  };
  relationships?: {
    top_pools?: { data?: Array<{ id: string }> };
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GeckoPool {
  /** Bare pool address hex (cardano_ prefix stripped) — feed to getOhlcv. */
  address: string;
  /** Normalized dex id, e.g. "minswap" or "saturnswap". */
  dexId: string;
  /** Pool label from GT, e.g. "SNEK / ADA". */
  name: string;
  baseTokenPriceUsd: number | null;
  quoteSymbol: string;
  reserveUsd: number;
  volume24hUsd: number;
  priceChange24h: number | null;
}

export interface GeckoTokenStats {
  /** Asset unit (policyId + assetNameHex, lowercase). */
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  /** Token's total reserve across GT-indexed (= Minswap) pools, USD. */
  reserveUsd: number;
  volume24hUsd: number;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  /** Bare address of the token's top pool, if GT reports one. */
  topPoolAddress: string | null;
}

export type GeckoTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "12h" | "1d" | "1w";

/** GT `currency=` param: "usd" candles or "token" (= quote-token, ADA). */
export type GeckoCurrency = "usd" | "token";

export interface Candle {
  /** Unix seconds (UTC), ascending. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** USD volume for the bucket. */
  volume: number;
}

export interface OhlcvResult {
  candles: Candle[];
  /**
   * Denomination of open/high/low/close. With currency=usd GT returns USD
   * even for ADA-quoted pools (verified: hourly close === base_token_price_usd);
   * with currency=token candles are quoted in the pool's quote token (ADA).
   * Volume stays USD either way.
   */
  quote: "USD" | "ADA";
  /** Pool base/quote symbols from GT meta, e.g. "SNEK/ADA". */
  poolLabel: string | null;
}

// ---------------------------------------------------------------------------
// Token pools
// ---------------------------------------------------------------------------

function mapPool(p: GtPoolRaw): GeckoPool {
  const name = p.attributes.name ?? "";
  const parts = name.split(" / ");
  return {
    address: stripNetworkPrefix(p.attributes.address ?? p.id),
    dexId: normalizeDexId(p.relationships?.dex?.data?.id ?? "minswap-cardano"),
    name,
    baseTokenPriceUsd: num(p.attributes.base_token_price_usd),
    quoteSymbol: parts.length > 1 ? parts[parts.length - 1].trim() : "ADA",
    reserveUsd: num(p.attributes.reserve_in_usd) ?? 0,
    volume24hUsd: num(p.attributes.volume_usd?.h24) ?? 0,
    priceChange24h: num(p.attributes.price_change_percentage?.h24),
  };
}

/**
 * Pools for a token, BASE side only (GT also returns pools where the unit
 * is the quote, e.g. NIGHT/SNEK on the SNEK page — same corruption risk as
 * the DexScreener quote-side filter in dex-data). Sorted by reserve desc.
 * VERIFIED: GET /networks/cardano/tokens/{unit}/pools returns SNEK/ADA on
 * minswap-cardano with reserve_in_usd ≈ $905k.
 */
export async function getTokenPools(unit: string): Promise<GeckoPool[]> {
  const asset = unit.toLowerCase();
  return cached(`gt:pools:${asset}`, TTL.tokenPools, async () => {
    const data = await gtFetch<{ data: GtPoolRaw[] }>(
      `/networks/cardano/tokens/${asset}/pools?page=1`
    );
    return (data.data ?? [])
      .filter((p) => p.relationships?.base_token?.data?.id === `cardano_${asset}`)
      .map(mapPool)
      .sort((a, b) => b.reserveUsd - a.reserveUsd);
  });
}

// ---------------------------------------------------------------------------
// Multi-token stats (screener merge)
// ---------------------------------------------------------------------------

/**
 * Batch token stats via /networks/cardano/tokens/multi/{a,b,c} (VERIFIED to
 * exist and accept comma-joined units; 30 addresses per call). GT's Cardano
 * coverage is Minswap (dominant) + SaturnSwap and excludes DexScreener's
 * Sundae/WingRiders, so total_reserve_in_usd / volume_usd.h24 here add
 * cleanly on top of DexScreener aggregates — what the screener merge needs.
 * Note: total_reserve_in_usd counts the token's side of reserves, so it is
 * smaller than the sum of full pool reserves from getTokenPools.
 * 31-token registry = 2 calls per cold refresh, cached 300 s ⇒ well inside
 * the documented ~10 req/min free tier.
 */
export async function getTokensMulti(units: string[]): Promise<Map<string, GeckoTokenStats>> {
  const out = new Map<string, GeckoTokenStats>();
  const normalized = [...new Set(units.map((u) => u.toLowerCase()))];
  const chunks: string[][] = [];
  for (let i = 0; i < normalized.length; i += 30) chunks.push(normalized.slice(i, i + 30));

  await Promise.all(
    chunks.map(async (batch) => {
      const key = `gt:multi:${batch.join(",")}`;
      const rows = await cached(key, TTL.tokensMulti, async () => {
        const data = await gtFetch<{ data: GtTokenRaw[] }>(
          `/networks/cardano/tokens/multi/${batch.join(",")}`
        );
        return data.data ?? [];
      });
      for (const t of rows) {
        const address = (t.attributes.address ?? stripNetworkPrefix(t.id)).toLowerCase();
        const topPoolId = t.relationships?.top_pools?.data?.[0]?.id;
        out.set(address, {
          address,
          symbol: t.attributes.symbol,
          name: t.attributes.name,
          priceUsd: num(t.attributes.price_usd),
          reserveUsd: num(t.attributes.total_reserve_in_usd) ?? 0,
          volume24hUsd: num(t.attributes.volume_usd?.h24) ?? 0,
          marketCapUsd: num(t.attributes.market_cap_usd),
          fdvUsd: num(t.attributes.fdv_usd),
          topPoolAddress: topPoolId ? stripNetworkPrefix(topPoolId) : null,
        });
      }
    })
  );
  return out;
}

// ---------------------------------------------------------------------------
// OHLCV
// ---------------------------------------------------------------------------

/**
 * GT path/aggregate per timeframe. "1w" has no upstream equivalent: we fetch
 * daily candles (limit=1000 ≈ 2.7 years) and aggregate into Monday-UTC weekly
 * buckets locally.
 */
const TF_MAP: Record<Exclude<GeckoTimeframe, "1w">, { path: string; aggregate: number }> = {
  "1m": { path: "minute", aggregate: 1 },
  "5m": { path: "minute", aggregate: 5 },
  "15m": { path: "minute", aggregate: 15 },
  "1h": { path: "hour", aggregate: 1 },
  "4h": { path: "hour", aggregate: 4 },
  "12h": { path: "hour", aggregate: 12 },
  "1d": { path: "day", aggregate: 1 },
};

/** Cache TTL per timeframe — short bars refresh fast, weekly barely moves. */
const OHLCV_TTL: Record<GeckoTimeframe, number> = {
  "1m": 30_000,
  "5m": 30_000,
  "15m": 60_000,
  "1h": 120_000,
  "4h": 120_000,
  "12h": 120_000,
  "1d": 600_000,
  "1w": 600_000,
};

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
/** 1970-01-01 was a Thursday; shift so buckets open Monday 00:00 UTC. */
const MONDAY_EPOCH_OFFSET = 3 * DAY_SECONDS;

/** Roll ascending daily candles into Monday-UTC weekly buckets. */
function aggregateWeekly(daily: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of daily) {
    const weekStart =
      Math.floor((c.time + MONDAY_EPOCH_OFFSET) / WEEK_SECONDS) * WEEK_SECONDS -
      MONDAY_EPOCH_OFFSET;
    const b = buckets.get(weekStart);
    if (!b) {
      buckets.set(weekStart, { ...c, time: weekStart });
    } else {
      // daily input is ascending, so the incoming candle always closes later
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += c.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

function parseOhlcvRows(rows: number[][]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const row of rows) {
    const [time, open, high, low, close, volume] = row;
    if (!Number.isFinite(time)) continue;
    // Skip rows with missing/zero OHLC — a null low coerced to 0 would
    // crush the whole price scale to zero on the chart.
    if (!(open! > 0) || !(high! > 0) || !(low! > 0) || !(close! > 0)) continue;
    byTime.set(time, {
      time,
      open: open!,
      high: high!,
      low: low!,
      close: close!,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Candles for a pool (bare address hex, NOT "cardano_"-prefixed).
 * GT shape: {data:{attributes:{ohlcv_list:[[ts,o,h,l,c,volUsd],...]}},
 * meta:{base:{symbol},quote:{symbol}}} — list is newest-first and can
 * duplicate the boundary row; we dedupe by ts and sort ascending.
 *
 * Upstream limit is ALWAYS 1000 so there is exactly one cache entry per
 * pool+tf+currency; `limit` only slices the tail of the cached window.
 */
export async function getOhlcv(
  poolAddress: string,
  tf: GeckoTimeframe,
  limit = 300,
  currency: GeckoCurrency = "usd"
): Promise<OhlcvResult> {
  const pool = stripNetworkPrefix(poolAddress.toLowerCase());
  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), 1000));
  const { path, aggregate } = TF_MAP[tf === "1w" ? "1d" : tf];
  const full = await cached(`gt:ohlcv:${pool}:${tf}:${currency}`, OHLCV_TTL[tf], async () => {
    const data = await gtFetch<{
      data: { attributes: { ohlcv_list: number[][] } };
      meta?: { base?: { symbol?: string }; quote?: { symbol?: string } };
    }>(
      `/networks/cardano/pools/${pool}/ohlcv/${path}?aggregate=${aggregate}&limit=1000&currency=${currency}`
    );
    const daily = parseOhlcvRows(data.data?.attributes?.ohlcv_list ?? []);
    const candles = tf === "1w" ? aggregateWeekly(daily) : daily;
    const base = data.meta?.base?.symbol;
    const quote = data.meta?.quote?.symbol;
    return {
      candles,
      quote: currency === "token" ? ("ADA" as const) : ("USD" as const),
      poolLabel: base && quote ? `${base}/${quote}` : null,
    };
  });
  return { ...full, candles: full.candles.slice(-cappedLimit) };
}
