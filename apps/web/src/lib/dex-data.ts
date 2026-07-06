/**
 * Basilisk data layer — server-side fetchers shared by /api/v1 route
 * handlers, page server components, and the MCP server.
 *
 * NOT for the browser: these hit DexScreener / Koios / CoinGecko /
 * handle.me directly (no CORS, keyless rate limits) and keep a
 * module-scope cache with serve-stale-on-error semantics.
 *
 * Coverage honesty: DexScreener indexes only SundaeSwap + WingRiders on
 * Cardano. Every aggregate response carries `coverage` so downstream UIs
 * can show the chip and never claim "total Cardano volume/liquidity".
 *
 * Upstream budgets:
 * - Koios public tier: 100 req / 10 s / IP → batch + cache.
 * - Keyless CoinGecko throttles after ~5 rapid calls → 90-120 s cache.
 * - Koios asset_addresses count MUST be `Prefer: count=estimated`
 *   (count=exact verified to time out after 30 s+ on large assets).
 */

import { after } from "next/server";

import { TOKEN_REGISTRY, TOKEN_REGISTRY_BY_ADDRESS } from "@/data/token-registry";

export const COVERAGE = "SundaeSwap + WingRiders via DexScreener";

const DEX_BASE = "https://api.dexscreener.com";
const KOIOS_BASE = "https://api.koios.rest/api/v1";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const HANDLE_BASE = "https://api.handle.me";
/** ADA Handle policy id (CIP-25 + CIP-68 mints share it). */
const ADA_HANDLE_POLICY = "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  hint?: string;
  constructor(status: number, message: string, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

// ---------------------------------------------------------------------------
// Cache: module-scope Map with TTL + serve-stale-on-error + in-flight dedupe
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Bounded insert: user-controlled keys (wallet:, search:, detail:) would
 * otherwise grow the module cache without limit on long-lived instances.
 * Eviction: expired entries first, then oldest by expiry (Map preserves
 * insertion order, so the first entries are the oldest).
 */
const MAX_CACHE_ENTRIES = 1_000;

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

const TTL = {
  screener: 45_000,
  detail: 60_000,
  wallet: 30_000,
  search: 30_000,
  coingecko: 90_000,
  series: 120_000,
  assetInfo: 24 * 60 * 60 * 1000, // supply/decimals rarely change
  holders: 24 * 60 * 60 * 1000,
  tip: 15_000,
} as const;

/** Sentinel wrapper so 400/404s can live in the cache and replay on hit. */
class CachedApiError {
  constructor(public error: ApiError) {}
}

const NEGATIVE_TTL = 30_000;

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheStore.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    if (hit.value instanceof CachedApiError) throw hit.value.error;
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
      // Negative-cache client-level failures (bad handle, unknown address)
      // so retries and bots don't re-trigger the upstream fan-out each time.
      if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
        setCache(key, new CachedApiError(err), NEGATIVE_TTL);
        throw err;
      }
      // Serve stale on upstream failure if we have anything at all.
      if (hit && !(hit.value instanceof CachedApiError)) return hit.value as T;
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function koiosGet<T>(path: string, timeoutMs = 15_000): Promise<T> {
  return fetchJson<T>(`${KOIOS_BASE}${path}`, { timeoutMs });
}

function koiosPost<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  return fetchJson<T>(`${KOIOS_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs,
  });
}

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_DEMO_KEY;
  // Header form is dash-separated; the underscore form is the query param.
  return key ? { "x-cg-demo-api-key": key } : {};
}

/** Allow only http(s) URLs from upstream token metadata (anyone can mint a
 * token with a javascript: website), and cap length so hrefs stay sane. */
export function safeUrl(u: unknown): string | null {
  if (typeof u !== "string" || u.length > 2048) return null;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// DexScreener types
// ---------------------------------------------------------------------------

interface DexPairRaw {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: Partial<Record<"m5" | "h1" | "h6" | "h24", { buys: number; sells: number }>>;
  volume?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  priceChange?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string; label?: string }>;
    socials?: Array<{ url: string; type?: string }>;
  };
}

export interface TokenLink {
  url: string;
  label?: string;
  type?: string;
}

export interface ScreenerToken {
  address: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number | null;
  change1h: number | null;
  change6h: number | null;
  change24h: number | null;
  volume24h: number;
  liquidityUsd: number;
  marketCap: number | null;
  fdv: number | null;
  buys24h: number;
  sells24h: number;
  txns24h: number;
  pairCount: number;
  dexIds: string[];
  topPairAddress: string | null;
  pairCreatedAt: number | null;
  websites?: TokenLink[];
  socials?: TokenLink[];
}

export interface PairRow {
  dexId: string;
  pairAddress: string;
  quoteSymbol: string;
  priceUsd: number | null;
  liquidityUsd: number;
  volume24h: number;
  buys24h: number;
  sells24h: number;
  url: string;
}

export interface ScreenerResponse {
  coverage: string;
  updatedAt: string;
  count: number;
  tokens: ScreenerToken[];
}

export interface TokenDetail extends ScreenerToken {
  coverage: string;
  pairs: PairRow[];
  policyId: string;
  assetNameHex: string;
  fingerprint: string | null;
  totalSupply: string | null;
  decimals: number | null;
  creationTime: number | null;
  description: string | null;
  holders: number | null;
}

// ---------------------------------------------------------------------------
// Pair aggregation
// ---------------------------------------------------------------------------

function aggregatePairs(address: string, pairs: DexPairRaw[]): ScreenerToken {
  const registry = TOKEN_REGISTRY_BY_ADDRESS.get(address);
  let volume24h = 0;
  let liquidityUsd = 0;
  let buys24h = 0;
  let sells24h = 0;
  let marketCap: number | null = null;
  let fdv: number | null = null;
  let pairCreatedAt: number | null = null;
  let priceWeighted = 0;
  let priceWeight = 0;
  let fallbackPrice: number | null = null;
  const dexIds = new Set<string>();
  let top: DexPairRaw | null = null;
  let topLiq = -1;

  // Liquidity-weighted change: use top pair's priceChange (most representative).
  for (const p of pairs) {
    const liq = p.liquidity?.usd ?? 0;
    volume24h += p.volume?.h24 ?? 0;
    liquidityUsd += liq;
    buys24h += p.txns?.h24?.buys ?? 0;
    sells24h += p.txns?.h24?.sells ?? 0;
    if (p.marketCap != null) marketCap = Math.max(marketCap ?? 0, p.marketCap);
    if (p.fdv != null) fdv = Math.max(fdv ?? 0, p.fdv);
    if (p.pairCreatedAt != null) {
      pairCreatedAt = pairCreatedAt == null ? p.pairCreatedAt : Math.min(pairCreatedAt, p.pairCreatedAt);
    }
    const price = num(p.priceUsd);
    if (price != null) {
      fallbackPrice = price;
      if (liq > 0) {
        priceWeighted += price * liq;
        priceWeight += liq;
      }
    }
    dexIds.add(p.dexId);
    if (liq > topLiq) {
      topLiq = liq;
      top = p;
    }
  }

  const websites = top?.info?.websites?.flatMap((w): TokenLink[] => {
    const url = safeUrl(w.url);
    return url ? [{ url, label: w.label }] : [];
  });
  const socials = top?.info?.socials?.flatMap((s): TokenLink[] => {
    const url = safeUrl(s.url);
    return url ? [{ url, type: s.type }] : [];
  });

  return {
    address,
    symbol: registry?.symbol ?? top?.baseToken.symbol ?? "?",
    name: registry?.name ?? top?.baseToken.name ?? address,
    imageUrl: top?.info?.imageUrl ?? null,
    priceUsd: priceWeight > 0 ? priceWeighted / priceWeight : fallbackPrice,
    change1h: top?.priceChange?.h1 ?? null,
    change6h: top?.priceChange?.h6 ?? null,
    change24h: top?.priceChange?.h24 ?? null,
    volume24h,
    liquidityUsd,
    marketCap,
    fdv,
    buys24h,
    sells24h,
    txns24h: buys24h + sells24h,
    pairCount: pairs.length,
    dexIds: [...dexIds],
    topPairAddress: top?.pairAddress ?? null,
    pairCreatedAt,
    ...(websites && websites.length ? { websites } : {}),
    ...(socials && socials.length ? { socials } : {}),
  };
}

function groupByBase(pairs: DexPairRaw[]): Map<string, DexPairRaw[]> {
  const groups = new Map<string, DexPairRaw[]>();
  for (const p of pairs) {
    if (p.chainId !== "cardano") continue;
    const addr = p.baseToken?.address;
    if (!addr || addr === "0x") continue;
    const list = groups.get(addr);
    if (list) list.push(p);
    else groups.set(addr, [p]);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Screener
// ---------------------------------------------------------------------------

/** Batch-price a list of asset units via DexScreener (max 30 per call). */
async function dexBatchPairs(addresses: string[]): Promise<DexPairRaw[]> {
  const batches = chunk(addresses, 30);
  const results = await Promise.all(
    batches.map((batch) =>
      fetchJson<DexPairRaw[]>(`${DEX_BASE}/tokens/v1/cardano/${batch.join(",")}`)
    )
  );
  return results.flat();
}

/** All pairs where the given unit is the BASE token. The batch /tokens/v1
 * endpoint returns only the single top pair per token, so real aggregation
 * (pairCount, summed volume/liquidity/txns) needs token-pairs per unit. */
async function dexTokenBasePairs(unit: string): Promise<DexPairRaw[]> {
  const pairs = await fetchJson<DexPairRaw[]>(`${DEX_BASE}/token-pairs/v1/cardano/${unit}`);
  // token-pairs also returns pairs where the unit is the QUOTE (e.g. the
  // NIGHT/USDM pool on the USDM page). Aggregating those corrupts price,
  // volume, liquidity, mcap and inverts buy/sell pressure — base side only.
  return pairs.filter((p) => p.chainId === "cardano" && p.baseToken?.address?.toLowerCase() === unit);
}

/**
 * Screener: the full registry enriched with live DexScreener data,
 * aggregated across each token's base-side pairs, sorted by liquidity desc.
 * ~30 parallel token-pairs calls per refresh, well inside 300 req/min,
 * cached 45 s (and CDN-cached via the route's s-maxage on top).
 */
export async function getScreener(): Promise<ScreenerResponse> {
  return cached("screener", TTL.screener, async () => {
    const results = await Promise.all(
      TOKEN_REGISTRY.map(async (t) => {
        const unit = t.address.toLowerCase();
        try {
          const pairs = await dexTokenBasePairs(unit);
          return pairs.length > 0 ? aggregatePairs(unit, pairs) : null;
        } catch {
          return null; // one token failing must not sink the screener
        }
      })
    );
    const tokens = results
      .filter((t): t is ScreenerToken => t != null)
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    if (tokens.length === 0) throw new Error("DexScreener returned no pairs for the registry");
    return {
      coverage: COVERAGE,
      updatedAt: new Date().toISOString(),
      count: tokens.length,
      tokens,
    };
  });
}

// ---------------------------------------------------------------------------
// Koios asset info + holders
// ---------------------------------------------------------------------------

interface KoiosAssetInfo {
  policy_id: string;
  asset_name: string | null;
  asset_name_ascii: string | null;
  fingerprint: string;
  total_supply: string;
  creation_time: number;
  token_registry_metadata: {
    name?: string;
    ticker?: string;
    description?: string;
    decimals?: number;
    url?: string;
  } | null;
}

function splitUnit(asset: string): { policyId: string; assetNameHex: string } {
  return { policyId: asset.slice(0, 56), assetNameHex: asset.slice(56) };
}

/** Koios asset_info for a batch of units. Cached 24 h each (logo stripped). */
async function koiosAssetInfoBatch(units: string[]): Promise<Map<string, KoiosAssetInfo>> {
  const out = new Map<string, KoiosAssetInfo>();
  const misses: string[] = [];
  for (const unit of units) {
    const hit = cacheStore.get(`asset_info:${unit}`);
    if (hit && hit.expiresAt > Date.now()) {
      if (hit.value) out.set(unit, hit.value as KoiosAssetInfo);
    } else {
      misses.push(unit);
    }
  }
  // ~8 assets per call: Koios public POST body cap is ~1 kb.
  for (const batch of chunk(misses, 8)) {
    try {
      const rows = await koiosPost<Array<KoiosAssetInfo & { token_registry_metadata: { logo?: string } | null }>>(
        "/asset_info",
        { _asset_list: batch.map((u) => [u.slice(0, 56), u.slice(56)]) }
      );
      const found = new Set<string>();
      for (const row of rows) {
        if (row.token_registry_metadata) delete row.token_registry_metadata.logo; // huge base64
        const unit = `${row.policy_id}${row.asset_name ?? ""}`;
        found.add(unit);
        out.set(unit, row);
        cacheStore.set(`asset_info:${unit}`, { value: row, expiresAt: Date.now() + TTL.assetInfo });
      }
      for (const unit of batch) {
        if (!found.has(unit)) {
          cacheStore.set(`asset_info:${unit}`, { value: null, expiresAt: Date.now() + TTL.assetInfo });
        }
      }
    } catch {
      // best-effort enrichment; skip failed batch
    }
  }
  return out;
}

/**
 * Holder count via Koios asset_addresses + `Prefer: count=estimated`
 * (content-range: "0-0/41461" → 41461). count=exact verified to time out.
 * Even estimated takes ~60 s cold for large assets, so the response only
 * waits `waitMs` (~2.5 s); the fill is handed to `after()` so Vercel keeps
 * the instance alive to finish it and populate the 24 h cache. Misses are
 * negative-cached for 10 min so cold tokens don't re-trigger long Koios
 * queries on every page view.
 */
const holdersInFlight = new Map<string, Promise<number | null>>();
const HOLDERS_NEGATIVE_TTL = 10 * 60 * 1000;

async function getHolders(policyId: string, assetNameHex: string, waitMs = 2_500): Promise<number | null> {
  const key = `holders:${policyId}${assetNameHex}`;
  const hit = cacheStore.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as number | null;

  let pending = holdersInFlight.get(key);
  if (!pending) {
    // Raw node:https instead of fetch: Next's request-scoped patched fetch
    // aborts in-flight requests when the route response finishes, which
    // would kill this ~60 s background fill every time.
    pending = (async () => {
      try {
        const { get } = await import("node:https");
        const range = await new Promise<string | null>((resolve, reject) => {
          const req = get(
            `${KOIOS_BASE}/asset_addresses?_asset_policy=${policyId}&_asset_name=${assetNameHex}&limit=1`,
            { headers: { Prefer: "count=estimated" }, timeout: 50_000 },
            (res) => {
              const header = res.headers["content-range"]; // e.g. "0-0/41461" or "*/0"
              res.resume(); // drain body
              res.on("end", () => resolve(typeof header === "string" ? header : null));
              res.on("error", reject);
            }
          );
          req.on("timeout", () => req.destroy(new Error("Koios holders timeout")));
          req.on("error", reject);
        });
        const total = range?.split("/")[1];
        const count = total && total !== "*" ? parseInt(total, 10) : NaN;
        const value = Number.isFinite(count) ? count : null;
        setCache(key, value, value != null ? TTL.holders : HOLDERS_NEGATIVE_TTL);
        return value;
      } catch {
        setCache(key, null, HOLDERS_NEGATIVE_TTL);
        return null;
      } finally {
        holdersInFlight.delete(key);
      }
    })();
    holdersInFlight.set(key, pending);
    // Keep the serverless instance alive past the response so the fill
    // actually completes and warms the cache. No-op risk: outside request
    // scope (build time) after() throws — fill becomes best-effort.
    try {
      after(pending.catch(() => null));
    } catch {
      /* best-effort */
    }
  }

  return Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
}

// ---------------------------------------------------------------------------
// Token detail
// ---------------------------------------------------------------------------

/**
 * Full token detail: all DexScreener pairs for the asset + Koios on-chain
 * facts (supply, decimals, fingerprint, mint time, registry description)
 * + estimated holder count. Returns null when neither source knows it.
 */
export async function getTokenDetail(asset: string): Promise<TokenDetail | null> {
  const unit = asset.toLowerCase();
  // Upper bound: policy (56) + max asset name (32 bytes = 64 hex) = 120.
  if (!/^[0-9a-f]{56,120}$/.test(unit)) {
    throw new ApiError(400, "Invalid asset unit", "Expected hex policyId + assetNameHex (56-120 hex chars).");
  }
  return cached(`detail:${unit}`, TTL.detail, async () => {
    const { policyId, assetNameHex } = splitUnit(unit);
    const [pairsResult, infoMap, holders] = await Promise.all([
      fetchJson<DexPairRaw[]>(`${DEX_BASE}/token-pairs/v1/cardano/${unit}`).catch(() => [] as DexPairRaw[]),
      koiosAssetInfoBatch([unit]),
      getHolders(policyId, assetNameHex),
    ]);

    // Base-side pairs only: token-pairs also returns pools where this unit
    // is the QUOTE (NIGHT/USDM on the USDM page) — aggregating those blends
    // other tokens' prices/volume/mcap in and inverts buy/sell direction.
    const cardanoPairs = pairsResult.filter(
      (p) => p.chainId === "cardano" && p.baseToken?.address?.toLowerCase() === unit
    );
    const info = infoMap.get(unit) ?? null;
    if (cardanoPairs.length === 0 && !info) return null;

    const base: ScreenerToken =
      cardanoPairs.length > 0
        ? aggregatePairs(unit, cardanoPairs)
        : {
            address: unit,
            symbol: info?.token_registry_metadata?.ticker ?? info?.asset_name_ascii ?? "?",
            name: info?.token_registry_metadata?.name ?? info?.asset_name_ascii ?? unit,
            imageUrl: null,
            priceUsd: null,
            change1h: null,
            change6h: null,
            change24h: null,
            volume24h: 0,
            liquidityUsd: 0,
            marketCap: null,
            fdv: null,
            buys24h: 0,
            sells24h: 0,
            txns24h: 0,
            pairCount: 0,
            dexIds: [],
            topPairAddress: null,
            pairCreatedAt: null,
          };

    const pairs: PairRow[] = cardanoPairs
      .map((p) => ({
        dexId: p.dexId,
        pairAddress: p.pairAddress,
        quoteSymbol: p.quoteToken?.symbol ?? "ADA",
        priceUsd: num(p.priceUsd),
        liquidityUsd: p.liquidity?.usd ?? 0,
        volume24h: p.volume?.h24 ?? 0,
        buys24h: p.txns?.h24?.buys ?? 0,
        sells24h: p.txns?.h24?.sells ?? 0,
        url: p.url,
      }))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);

    return {
      ...base,
      coverage: COVERAGE,
      pairs,
      policyId,
      assetNameHex,
      fingerprint: info?.fingerprint ?? null,
      totalSupply: info?.total_supply ?? null,
      decimals: info?.token_registry_metadata?.decimals ?? null,
      creationTime: info?.creation_time ?? null,
      description: info?.token_registry_metadata?.description ?? null,
      holders,
    };
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResponse {
  coverage: string;
  query: string;
  count: number;
  tokens: ScreenerToken[];
}

/** DexScreener search, filtered to Cardano, deduped by base token. */
export async function searchTokens(q: string): Promise<SearchResponse> {
  const query = q.trim().slice(0, 64);
  if (!query) throw new ApiError(400, "Missing query", "Pass ?q=<ticker or name>.");
  return cached(`search:${query.toLowerCase()}`, TTL.search, async () => {
    const data = await fetchJson<{ pairs: DexPairRaw[] | null }>(
      `${DEX_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`
    );
    const groups = groupByBase(data.pairs ?? []);
    const tokens = [...groups.entries()]
      .map(([addr, list]) => aggregatePairs(addr, list))
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    return { coverage: COVERAGE, query, count: tokens.length, tokens };
  });
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export interface WalletHolding {
  unit: string;
  policyId: string;
  assetNameHex: string;
  name: string;
  ticker: string | null;
  decimals: number;
  quantity: string;
  priceUsd: number | null;
  valueUsd: number | null;
  priceSource: string | null;
}

export interface WalletResponse {
  input: string;
  stakeAddress: string | null;
  paymentAddress?: string;
  adaBalance: number;
  adaValueUsd: number | null;
  rewards: number;
  pool: string | null;
  holdings: WalletHolding[];
  /** True when the wallet held more assets than the response cap. */
  truncated?: boolean;
  totalValueUsd: number | null;
  coverage: string;
}

interface KoiosAccountAsset {
  policy_id: string;
  asset_name: string | null;
  fingerprint: string;
  decimals: number;
  quantity: string;
}

function hexEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("hex");
}

function hexDecode(hex: string): string {
  try {
    const s = Buffer.from(hex, "hex").toString("utf8");
    return /^[\x20-\x7e]*$/.test(s) ? s : hex;
  } catch {
    return hex;
  }
}

/** Resolve $handle → stake address. handle.me first, Koios asset_addresses fallback. */
async function resolveHandle(handle: string): Promise<{ stakeAddress: string | null; paymentAddress?: string }> {
  const name = handle.replace(/^\$/, "").toLowerCase();
  if (!name) throw new ApiError(400, "Empty handle", "Pass $<handle>, e.g. $wes.");
  try {
    const data = await fetchJson<{ holder?: string; resolved_addresses?: { ada?: string } }>(
      `${HANDLE_BASE}/handles/${encodeURIComponent(name)}`
    );
    if (data.holder) {
      return { stakeAddress: data.holder, paymentAddress: data.resolved_addresses?.ada };
    }
  } catch {
    // fall through to Koios
  }
  // Fallback: locate the handle NFT on-chain (raw CIP-25 hex, then CIP-68 "000de140" prefix).
  const hex = hexEncode(name);
  for (const assetName of [hex, `000de140${hex}`]) {
    try {
      const rows = await koiosGet<Array<{ payment_address: string }>>(
        `/asset_addresses?_asset_policy=${ADA_HANDLE_POLICY}&_asset_name=${assetName}&limit=1`
      );
      const payment = rows[0]?.payment_address;
      if (payment) {
        const info = await koiosPost<Array<{ stake_address: string | null }>>("/address_info", {
          _addresses: [payment],
        });
        return { stakeAddress: info[0]?.stake_address ?? null, paymentAddress: payment };
      }
    } catch {
      // try next encoding
    }
  }
  throw new ApiError(404, `Handle $${name} not found`, "Check the spelling, or pass an addr1/stake1 address.");
}

/**
 * Wallet overview for addr1... | stake1... | $handle.
 * Holdings enriched via Koios asset_info (names/decimals, 8 units per call —
 * public POST body cap ~1 kb) and priced via DexScreener batches (30 units
 * per call, capped at ~60 priced holdings). Unpriced holdings keep
 * valueUsd: null rather than being dropped.
 */
/** Bech32 payload charset (no 1/b/i/o). Mainnet addr ≈ 58-110 chars, stake = 59. */
const ADDR_RE = /^addr1[02-9ac-hj-np-z]{20,110}$/;
const STAKE_RE = /^stake1[02-9ac-hj-np-z]{20,60}$/;
/** ADA Handles: 1-15 chars, a-z 0-9 . _ - */
const HANDLE_RE = /^\$[a-z0-9._-]{1,15}$/;

export async function getWallet(input: string): Promise<WalletResponse> {
  const raw = input.trim();
  if (!raw) throw new ApiError(400, "Empty wallet input", "Pass addr1..., stake1..., or $handle.");
  if (raw.length > 120) throw new ApiError(400, "Wallet input too long");
  const lowered = raw.toLowerCase();
  if (
    !(lowered.startsWith("$") ? HANDLE_RE.test(lowered) : ADDR_RE.test(lowered) || STAKE_RE.test(lowered))
  ) {
    throw new ApiError(
      400,
      "Unrecognized wallet input",
      "Pass addr1..., stake1..., or $handle (1-15 chars; URL-encode $ as %24)."
    );
  }
  return cached(`wallet:${lowered}`, TTL.wallet, async () => {
    let stakeAddress: string | null = null;
    let paymentAddress: string | undefined;

    if (lowered.startsWith("$")) {
      const resolved = await resolveHandle(lowered);
      stakeAddress = resolved.stakeAddress;
      paymentAddress = resolved.paymentAddress;
    } else if (lowered.startsWith("addr1")) {
      paymentAddress = lowered;
      const info = await koiosPost<Array<{ stake_address: string | null; balance: string }>>(
        "/address_info",
        { _addresses: [lowered] }
      );
      if (!info[0]) throw new ApiError(404, "Address not found", "Koios returned no info for this address.");
      stakeAddress = info[0].stake_address;
      if (!stakeAddress) {
        // Enterprise address (no stake key): report balance + assets for the single address.
        const assets = await koiosPost<KoiosAccountAsset[]>("/address_assets", { _addresses: [lowered] }).catch(
          () => [] as KoiosAccountAsset[]
        );
        return buildWallet(raw, null, lowered, Number(info[0].balance) / 1e6, 0, null, assets);
      }
    } else {
      stakeAddress = lowered;
    }

    if (!stakeAddress) throw new ApiError(404, "Could not resolve a stake address for this input");

    const [accountInfo, accountAssets] = await Promise.all([
      koiosPost<Array<{
        total_balance: string;
        rewards_available: string;
        delegated_pool: string | null;
        status: string;
      }>>("/account_info", { _stake_addresses: [stakeAddress] }),
      koiosPost<KoiosAccountAsset[]>("/account_assets", { _stake_addresses: [stakeAddress] }).catch(
        () => [] as KoiosAccountAsset[]
      ),
    ]);
    const account = accountInfo[0];
    if (!account) throw new ApiError(404, "Stake account not found", "Koios returned no account info.");

    return buildWallet(
      raw,
      stakeAddress,
      paymentAddress,
      Number(account.total_balance) / 1e6,
      Number(account.rewards_available) / 1e6,
      account.delegated_pool,
      accountAssets
    );
  });
}

const MAX_PRICED_HOLDINGS = 60;

async function buildWallet(
  input: string,
  stakeAddress: string | null,
  paymentAddress: string | undefined,
  adaBalance: number,
  rewards: number,
  pool: string | null,
  assets: KoiosAccountAsset[]
): Promise<WalletResponse> {
  // NFT-heavy wallets can hold thousands of assets — cap the response.
  const MAX_HOLDINGS = 500;
  const truncated = assets.length > MAX_HOLDINGS;
  if (truncated) assets = assets.slice(0, MAX_HOLDINGS);
  // Registry tokens first so the priced cap favors liquid assets.
  const sorted = [...assets].sort((a, b) => {
    const aReg = TOKEN_REGISTRY_BY_ADDRESS.has(`${a.policy_id}${a.asset_name ?? ""}`) ? 0 : 1;
    const bReg = TOKEN_REGISTRY_BY_ADDRESS.has(`${b.policy_id}${b.asset_name ?? ""}`) ? 0 : 1;
    return aReg - bReg;
  });

  const units = sorted.map((a) => `${a.policy_id}${a.asset_name ?? ""}`);
  const toPrice = units.slice(0, MAX_PRICED_HOLDINGS);
  const toEnrich = units.slice(0, MAX_PRICED_HOLDINGS);

  const [adaMarket, infoMap, pricePairs] = await Promise.all([
    getAdaMarket().catch(() => null),
    koiosAssetInfoBatch(toEnrich),
    toPrice.length ? dexBatchPairs(toPrice).catch(() => [] as DexPairRaw[]) : Promise.resolve([] as DexPairRaw[]),
  ]);

  const priceByUnit = new Map<string, number>();
  for (const [addr, list] of groupByBase(pricePairs)) {
    const agg = aggregatePairs(addr, list);
    if (agg.priceUsd != null) priceByUnit.set(addr, agg.priceUsd);
  }

  let holdingsValueUsd = 0;
  let anyPriced = false;
  const holdings: WalletHolding[] = sorted.map((a, i) => {
    const unit = units[i];
    const info = infoMap.get(unit);
    const registry = TOKEN_REGISTRY_BY_ADDRESS.get(unit);
    const decimals = info?.token_registry_metadata?.decimals ?? a.decimals ?? 0;
    const amount = Number(a.quantity) / 10 ** decimals;
    const priceUsd = priceByUnit.get(unit) ?? null;
    const valueUsd = priceUsd != null ? amount * priceUsd : null;
    if (valueUsd != null) {
      holdingsValueUsd += valueUsd;
      anyPriced = true;
    }
    return {
      unit,
      policyId: a.policy_id,
      assetNameHex: a.asset_name ?? "",
      name:
        registry?.name ??
        info?.token_registry_metadata?.name ??
        info?.asset_name_ascii ??
        hexDecode(a.asset_name ?? ""),
      ticker: registry?.symbol ?? info?.token_registry_metadata?.ticker ?? null,
      decimals,
      quantity: a.quantity,
      priceUsd,
      valueUsd,
      priceSource: priceUsd != null ? COVERAGE : null,
    };
  });

  const adaValueUsd = adaMarket ? adaBalance * adaMarket.priceUsd : null;
  const totalValueUsd =
    adaValueUsd != null ? adaValueUsd + holdingsValueUsd : anyPriced ? holdingsValueUsd : null;

  return {
    input,
    stakeAddress,
    ...(paymentAddress ? { paymentAddress } : {}),
    adaBalance,
    adaValueUsd,
    rewards,
    pool,
    holdings,
    ...(truncated ? { truncated } : {}),
    totalValueUsd,
    coverage: COVERAGE,
  };
}

// ---------------------------------------------------------------------------
// CoinGecko (ADA market + series + ecosystem list) — keyless CG throttles
// after ~5 rapid calls; the module cache is the protection.
// ---------------------------------------------------------------------------

export interface AdaMarket {
  priceUsd: number;
  change24h: number | null;
  marketCap: number;
  volume24h: number;
}

export async function getAdaMarket(): Promise<AdaMarket> {
  return cached("cg:ada", TTL.coingecko, async () => {
    const data = await fetchJson<{
      cardano?: { usd: number; usd_24h_change?: number; usd_market_cap?: number; usd_24h_vol?: number };
    }>(
      `${COINGECKO_BASE}/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { headers: cgHeaders() }
    );
    const ada = data.cardano;
    if (!ada) throw new Error("CoinGecko returned no cardano data");
    return {
      priceUsd: ada.usd,
      change24h: ada.usd_24h_change ?? null,
      marketCap: ada.usd_market_cap ?? 0,
      volume24h: ada.usd_24h_vol ?? 0,
    };
  });
}

/** ADA USD price series. days=1 → 5-min candles; 7 → hourly. */
export async function getAdaSeries(days: number): Promise<Array<[number, number]>> {
  const d = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 1;
  return cached(`cg:series:${d}`, TTL.series, async () => {
    const data = await fetchJson<{ prices?: Array<[number, number]> }>(
      `${COINGECKO_BASE}/coins/cardano/market_chart?vs_currency=usd&days=${d}`,
      { headers: cgHeaders() }
    );
    return data.prices ?? [];
  });
}

export interface EcosystemToken {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number | null;
  marketCap: number;
  volume24h: number;
}

/** CoinGecko cardano-ecosystem category (CEX+DEX pricing, distinct from DexScreener coverage). */
export async function getEcosystemTokens(limit = 50): Promise<EcosystemToken[]> {
  return cached(`cg:ecosystem:${limit}`, TTL.coingecko, async () => {
    const data = await fetchJson<Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number | null;
      price_change_percentage_24h: number | null;
      market_cap: number | null;
      total_volume: number | null;
    }>>(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&category=cardano-ecosystem&order=market_cap_desc&per_page=${limit}&page=1&price_change_percentage=24h`,
      { headers: cgHeaders() }
    );
    return data
      .filter((t) => t.id !== "cardano")
      .map((t) => ({
        id: t.id,
        symbol: t.symbol.toUpperCase(),
        name: t.name,
        priceUsd: t.current_price ?? 0,
        change24h: t.price_change_percentage_24h,
        marketCap: t.market_cap ?? 0,
        volume24h: t.total_volume ?? 0,
      }));
  });
}

// ---------------------------------------------------------------------------
// Chain tip
// ---------------------------------------------------------------------------

export interface ChainTip {
  block: number;
  epoch: number;
  epochSlot: number;
  hash: string;
  blockTime: number;
}

export async function getChainTip(): Promise<ChainTip> {
  return cached("koios:tip", TTL.tip, async () => {
    const rows = await koiosGet<Array<{
      hash: string;
      epoch_no: number;
      abs_slot: number;
      epoch_slot: number;
      block_no: number;
      block_time: number;
    }>>("/tip");
    const tip = rows[0];
    if (!tip) throw new Error("Koios /tip returned no rows");
    return {
      block: tip.block_no,
      epoch: tip.epoch_no,
      epochSlot: tip.epoch_slot,
      hash: tip.hash,
      blockTime: tip.block_time,
    };
  });
}
