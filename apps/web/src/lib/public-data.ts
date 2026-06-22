/**
 * Free public Cardano + crypto data sources.
 *
 * No auth, CORS-friendly, no key required. Used by the dashboard so
 * the UI works on Vercel without our self-hosted Fastify gateway up.
 *
 * Migration plan: when the gateway is hosted, swap these helpers for
 * `lib/api.ts` calls. The shape of the data returned is intentionally
 * a tight subset of what our internal API exposes so the swap is one
 * import change per page.
 */

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface ChainTip {
  block: number;
  epoch: number;
  epochSlot: number;
  hash: string;
  blockTime: number;
}

export interface AdaMarket {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

export interface CntToken {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  marketCap: number;
  volume24h: number;
}

/**
 * Cardano chain tip. Proxied through our own /api/chain-tip route because
 * Koios doesn't send CORS headers for browser callers. Cached 15s upstream.
 */
export async function fetchChainTip(): Promise<ChainTip | null> {
  try {
    const res = await fetch(`/api/chain-tip`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: ChainTip | null };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** ADA market snapshot from CoinGecko. */
export async function fetchAdaMarket(): Promise<AdaMarket | null> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ada = data.cardano;
    if (!ada) return null;
    return {
      price: ada.usd,
      change24h: ada.usd_24h_change,
      marketCap: ada.usd_market_cap,
      volume24h: ada.usd_24h_vol,
    };
  } catch {
    return null;
  }
}

/** ADA price series for charts. days=1 returns 5-min granularity; days=7 returns hourly. */
const adaSeriesCache = new Map<number, Array<[number, number]>>();
export async function fetchAdaSeries(days: number): Promise<Array<[number, number]> | null> {
  const cached = adaSeriesCache.get(days);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/cardano/market_chart?vs_currency=usd&days=${days}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const prices = (data?.prices ?? []) as Array<[number, number]>;
    adaSeriesCache.set(days, prices);
    return prices;
  } catch {
    return null;
  }
}

/** Cardano-ecosystem tokens via CoinGecko. Filtered to those with 24H price data. */
export async function fetchCardanoTokens(limit = 50): Promise<CntToken[]> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&category=cardano-ecosystem&order=market_cap_desc&per_page=${limit}&page=1&price_change_percentage=24h`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_percentage_24h: number | null;
      market_cap: number;
      total_volume: number;
    }>;
    return data
      .filter((t) => t.id !== "cardano")
      .map((t) => ({
        id: t.id,
        symbol: t.symbol.toUpperCase(),
        name: t.name,
        price: t.current_price ?? 0,
        change24h: t.price_change_percentage_24h,
        marketCap: t.market_cap ?? 0,
        volume24h: t.total_volume ?? 0,
      }));
  } catch {
    return [];
  }
}

/** Top movers — sorted by absolute 24h % change. */
export async function fetchTopMovers(limit = 5): Promise<CntToken[]> {
  const all = await fetchCardanoTokens(50);
  return [...all]
    .filter((t) => t.change24h != null)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
    .slice(0, limit);
}

/** Top gainers only. */
export async function fetchTopGainers(limit = 5): Promise<CntToken[]> {
  const all = await fetchCardanoTokens(50);
  return [...all]
    .filter((t) => (t.change24h ?? 0) > 0)
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
    .slice(0, limit);
}

/** Top losers only. */
export async function fetchTopLosers(limit = 5): Promise<CntToken[]> {
  const all = await fetchCardanoTokens(50);
  return [...all]
    .filter((t) => (t.change24h ?? 0) < 0)
    .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
    .slice(0, limit);
}

export interface TokenDetail {
  id: string;
  symbol: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  marketCap: number;
  marketCapRank: number | null;
  volume24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChangePct: number | null;
  athDate: string;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  fdv: number | null;
  homepage: string;
  twitter: string;
  policyId?: string;
}

/** Per-token detail. CoinGecko /coins/{id}. */
export async function fetchTokenDetail(id: string): Promise<TokenDetail | null> {
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const m = data.market_data ?? {};
    return {
      id: data.id,
      symbol: (data.symbol ?? "").toUpperCase(),
      name: data.name ?? id,
      description: (data.description?.en ?? "").split(". ").slice(0, 2).join(". "),
      imageUrl: data.image?.small ?? "",
      price: m.current_price?.usd ?? 0,
      change24h: m.price_change_percentage_24h ?? null,
      change7d: m.price_change_percentage_7d ?? null,
      change30d: m.price_change_percentage_30d ?? null,
      marketCap: m.market_cap?.usd ?? 0,
      marketCapRank: m.market_cap_rank ?? null,
      volume24h: m.total_volume?.usd ?? 0,
      high24h: m.high_24h?.usd ?? 0,
      low24h: m.low_24h?.usd ?? 0,
      ath: m.ath?.usd ?? 0,
      athChangePct: m.ath_change_percentage?.usd ?? null,
      athDate: m.ath_date?.usd ?? "",
      circulatingSupply: m.circulating_supply ?? 0,
      totalSupply: m.total_supply ?? null,
      maxSupply: m.max_supply ?? null,
      fdv: m.fully_diluted_valuation?.usd ?? null,
      homepage: data.links?.homepage?.[0] ?? "",
      twitter: data.links?.twitter_screen_name ?? "",
      policyId: data.contract_address ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Per-token price series. days=1 returns 5-min granularity; days=7 returns hourly. */
const tokenSeriesCache = new Map<string, Array<[number, number]>>();
export async function fetchTokenSeries(id: string, days: number): Promise<Array<[number, number]> | null> {
  const key = `${id}:${days}`;
  const cached = tokenSeriesCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const prices = (data?.prices ?? []) as Array<[number, number]>;
    tokenSeriesCache.set(key, prices);
    return prices;
  } catch {
    return null;
  }
}

/** Formatting helpers used across dashboard surfaces. */
export function fmtUsd(n: number, digits = 4): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(digits)}`;
}

export function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString();
}
