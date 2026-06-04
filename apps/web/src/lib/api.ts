/**
 * API client for the Basilisk API gateway.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// -- Types matching API responses --

interface PriceData {
  asset: string;
  priceAda: string;
  priceUsd: string | null;
  volumeAda: string;
  timestamp: number;
}

interface CandleData {
  asset: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeAda: string;
  tradeCount: number;
}

interface SwapData {
  txHash: string;
  dex: string;
  assetIn: string;
  amountIn: string;
  assetOut: string;
  amountOut: string;
  senderAddress: string | null;
  timestamp: number;
}

interface StatsData {
  latestBlock: { height: number; slot: number; epoch: number; timestamp: number } | null;
  transactions24h: number;
  dexVolumeLovelace24h: string;
}

interface TokenData {
  asset: string;
  policyId: string;
  assetName: string;
  ticker: string | null;
  name: string | null;
  decimals: number;
  price: PriceData | null;
}

// -- API functions --

export async function fetchPrices(limit = 50): Promise<PriceData[]> {
  const res = await fetchApi<{ data: PriceData[] }>(`/api/prices?limit=${limit}`);
  return res.data;
}

export async function fetchPriceHistory(asset: string, hours = 24): Promise<PriceData[]> {
  const res = await fetchApi<{ data: PriceData[] }>(`/api/prices/${encodeURIComponent(asset)}?hours=${hours}`);
  return res.data;
}

export async function fetchCandles(asset: string, interval = "1h", hours = 24): Promise<CandleData[]> {
  const res = await fetchApi<{ data: CandleData[] }>(
    `/api/candles/${encodeURIComponent(asset)}?interval=${interval}&hours=${hours}`,
  );
  return res.data;
}

export async function fetchSwaps(asset: string, limit = 50): Promise<SwapData[]> {
  const res = await fetchApi<{ data: SwapData[] }>(
    `/api/swaps/${encodeURIComponent(asset)}?limit=${limit}`,
  );
  return res.data;
}

export async function fetchStats(): Promise<StatsData> {
  const res = await fetchApi<{ data: StatsData }>("/api/stats");
  return res.data;
}

export async function fetchTokens(search?: string): Promise<TokenData[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetchApi<{ data: TokenData[] }>(`/api/tokens${params}`);
  return res.data;
}

export async function fetchToken(asset: string): Promise<TokenData | null> {
  try {
    const res = await fetchApi<{ data: TokenData }>(`/api/tokens/${encodeURIComponent(asset)}`);
    return res.data;
  } catch {
    return null;
  }
}
