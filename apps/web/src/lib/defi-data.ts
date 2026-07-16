/**
 * Basilisk DeFi scoreboard data layer — DefiLlama free endpoints, server-side
 * only (no key, no CORS from the browser; keep upstream fan-out here).
 *
 * Upstreams (all keyless):
 * - https://api.llama.fi/v2/historicalChainTvl/Cardano
 *     → Array<{ date: number (unix s), tvl: number (USD) }>, daily.
 * - https://api.llama.fi/protocols
 *     → Array<protocol>; we filter `chains` includes "Cardano" and read
 *       per-chain TVL from `chainTvls.Cardano` (NOT `tvl`, which is
 *       all-chains). `change_7d` is protocol-wide (all chains) — surfaced
 *       as-is and labeled honestly downstream.
 * - https://stablecoins.llama.fi/stablecoincharts/Cardano
 *     → Array<{ date: string, totalCirculatingUSD: { peggedUSD: number } }>.
 *
 * Cache: same idioms as dex-data.ts — module-scope bounded Map, 10 min TTL,
 * in-flight dedupe, serve-stale-on-error. DefiLlama refreshes roughly hourly,
 * so 10 min is already generous; the CDN s-maxage on the route stacks on top.
 *
 * Coverage honesty: chain TVL (~the headline number) is DefiLlama's default
 * chain series, which EXCLUDES CEX and de-doubles bridged liquidity. The
 * protocol table therefore also excludes `category === "CEX"` rows, and the
 * per-protocol TVLs can sum to more than the chain TVL (bridges etc.) — do
 * not present the column sum as "total Cardano TVL".
 */

const LLAMA_BASE = "https://api.llama.fi";
const LLAMA_STABLES_BASE = "https://stablecoins.llama.fi";

// ---------------------------------------------------------------------------
// Cache: bounded TTL + serve-stale-on-error + in-flight dedupe
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Keys here are fixed strings, but keep the bound anyway (house idiom). */
const MAX_CACHE_ENTRIES = 100;

const DEFI_TTL = 10 * 60 * 1000; // 10 min

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

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheStore.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await load();
      setCache(key, value, ttlMs);
      return value;
    } catch (err) {
      // Serve stale on upstream failure if we have anything at all.
      if (hit) return hit.value as T;
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

async function fetchJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** https-only guard for upstream-provided URLs (logos). */
function safeHttpsUrl(u: unknown): string | null {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    return new URL(u).protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DefiProtocol {
  rank: number;
  name: string;
  category: string;
  /** Cardano-only TVL from chainTvls.Cardano (USD). */
  tvlUsd: number;
  /** Protocol-wide (all chains) 7d TVL change %, per DefiLlama /protocols. */
  change7d: number | null;
  /** icons.llamao.fi URL, https-verified, or null. */
  logo: string | null;
  /** defillama.com protocol page, or null when the slug looked unsafe. */
  url: string | null;
}

export interface DefiOverview {
  updatedAt: string;
  source: "DefiLlama";
  refreshMinutes: number;
  tvl: {
    /** Latest daily chain TVL (USD). */
    current: number;
    /** % change vs previous daily point / 7 daily points back. */
    change24h: number | null;
    change7d: number | null;
    /** Full daily series: [unix seconds, USD]. */
    series: Array<[number, number]>;
  };
  stablecoins: {
    current: number;
    change7d: number | null;
    series: Array<[number, number]>;
  } | null;
  /** Count of DeFi protocols on Cardano (CEX rows excluded). */
  protocolCount: number;
  /** Top protocols by Cardano TVL, CEX excluded. */
  protocols: DefiProtocol[];
}

// ---------------------------------------------------------------------------
// Upstream shapes (only the fields we read)
// ---------------------------------------------------------------------------

interface LlamaChainTvlPoint {
  date: number;
  tvl: number;
}

interface LlamaProtocol {
  name: string;
  slug?: string;
  category?: string;
  chains?: string[];
  chainTvls?: Record<string, number>;
  change_7d?: number | null;
  logo?: string;
}

interface LlamaStablePoint {
  date: string;
  totalCirculatingUSD?: { peggedUSD?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctChange(now: number, then: number | undefined): number | null {
  if (then == null || !Number.isFinite(then) || then === 0) return null;
  return ((now - then) / then) * 100;
}

const SLUG_RE = /^[a-z0-9-]+$/i;

const TOP_PROTOCOLS = 15;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * Full scoreboard payload. Chain TVL + protocols are required (failure →
 * serve-stale/throw); the stablecoin series is best-effort and becomes null
 * so one flaky upstream never blanks the page.
 */
export async function getDefiOverview(): Promise<DefiOverview> {
  return cached("defi:overview", DEFI_TTL, async () => {
    const [chainTvl, protocolsRaw, stablesRaw] = await Promise.all([
      fetchJson<LlamaChainTvlPoint[]>(`${LLAMA_BASE}/v2/historicalChainTvl/Cardano`),
      fetchJson<LlamaProtocol[]>(`${LLAMA_BASE}/protocols`),
      fetchJson<LlamaStablePoint[]>(`${LLAMA_STABLES_BASE}/stablecoincharts/Cardano`).catch(
        () => null
      ),
    ]);

    // --- Chain TVL series --------------------------------------------------
    const series: Array<[number, number]> = chainTvl
      .filter((p) => Number.isFinite(p.date) && Number.isFinite(p.tvl))
      .map((p) => [p.date, p.tvl]);
    if (series.length === 0) throw new Error("DefiLlama returned an empty Cardano TVL series");
    const last = series[series.length - 1];
    const tvl = {
      current: last[1],
      change24h: pctChange(last[1], series[series.length - 2]?.[1]),
      change7d: pctChange(last[1], series[series.length - 8]?.[1]),
      series,
    };

    // --- Protocols (CEX excluded — chain TVL excludes CEX too) -------------
    const cardano = protocolsRaw.filter(
      (p) =>
        Array.isArray(p.chains) &&
        p.chains.includes("Cardano") &&
        p.category !== "CEX" &&
        Number.isFinite(p.chainTvls?.Cardano)
    );
    cardano.sort((a, b) => (b.chainTvls?.Cardano ?? 0) - (a.chainTvls?.Cardano ?? 0));
    const protocols: DefiProtocol[] = cardano.slice(0, TOP_PROTOCOLS).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      category: p.category ?? "—",
      tvlUsd: p.chainTvls?.Cardano ?? 0,
      change7d: typeof p.change_7d === "number" && Number.isFinite(p.change_7d) ? p.change_7d : null,
      logo: safeHttpsUrl(p.logo),
      url:
        p.slug && SLUG_RE.test(p.slug)
          ? `https://defillama.com/protocol/${p.slug}`
          : null,
    }));

    // --- Stablecoins (best-effort) -----------------------------------------
    let stablecoins: DefiOverview["stablecoins"] = null;
    if (stablesRaw && stablesRaw.length > 0) {
      const sSeries: Array<[number, number]> = stablesRaw
        .map((p): [number, number] => [
          parseInt(p.date, 10),
          p.totalCirculatingUSD?.peggedUSD ?? NaN,
        ])
        .filter(([d, v]) => Number.isFinite(d) && Number.isFinite(v));
      if (sSeries.length > 0) {
        const sLast = sSeries[sSeries.length - 1];
        stablecoins = {
          current: sLast[1],
          change7d: pctChange(sLast[1], sSeries[sSeries.length - 8]?.[1]),
          series: sSeries,
        };
      }
    }

    return {
      updatedAt: new Date().toISOString(),
      source: "DefiLlama" as const,
      refreshMinutes: 10,
      tvl,
      stablecoins,
      protocolCount: cardano.length,
      protocols,
    };
  });
}
