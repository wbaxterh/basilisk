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

interface TokenDetailData extends TokenData {
  logoUrl: string | null;
  description: string | null;
  website: string | null;
  updatedAt: number;
  changePercent24h: number | null;
  volume24h: string;
  holders: number;
  totalSupply: string | null;
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

export async function fetchToken(asset: string): Promise<TokenDetailData | null> {
  try {
    const res = await fetchApi<{ data: TokenDetailData }>(`/api/tokens/${encodeURIComponent(asset)}`);
    return res.data;
  } catch {
    return null;
  }
}

// -- Holders --

export interface HolderEntry {
  rank: number;
  address: string;
  quantity: string;
  percentage: number;
}

export interface TokenHoldersData {
  holders: HolderEntry[];
  totalSupply: string;
  concentration: {
    top10Percentage: number;
    top20Percentage: number;
    holderCount: number;
  };
}

export async function fetchTokenHolders(asset: string): Promise<TokenHoldersData> {
  const res = await fetchApi<{ data: TokenHoldersData }>(
    `/api/tokens/${encodeURIComponent(asset)}/holders`,
  );
  return res.data;
}

// -- Screener --

export interface ScreenerRow {
  rank: number;
  asset: string;
  ticker: string | null;
  priceAda: string;
  priceUsd: string | null;
  volumeAda: string;
  change24h: string | null;
}

export async function fetchScreenerTop(limit = 50): Promise<ScreenerRow[]> {
  const res = await fetchApi<{ data: ScreenerRow[] }>(`/api/screener/top?limit=${limit}`);
  return res.data;
}

export async function fetchScreenerGainers(limit = 50): Promise<ScreenerRow[]> {
  const res = await fetchApi<{ data: ScreenerRow[] }>(`/api/screener/gainers?limit=${limit}`);
  return res.data;
}

export async function fetchScreenerLosers(limit = 50): Promise<ScreenerRow[]> {
  const res = await fetchApi<{ data: ScreenerRow[] }>(`/api/screener/losers?limit=${limit}`);
  return res.data;
}

// -- Portfolio / Wallet --

interface HoldingData {
  asset: string;
  quantity: string;
  valueAda: string;
  valueUsd: string | null;
  avgCostAda: string | null;
}

interface WalletHoldingsResponse {
  data: HoldingData[];
  meta: { stakeAddress: string; tracked: boolean };
}

export async function fetchWalletHoldings(stakeAddress: string): Promise<WalletHoldingsResponse> {
  return fetchApi<WalletHoldingsResponse>(`/api/wallets/${encodeURIComponent(stakeAddress)}/holdings`);
}

export interface PortfolioSnapshot {
  time: number;
  totalValueAda: string;
}

export async function fetchPortfolioHistory(stakeAddress: string): Promise<PortfolioSnapshot[]> {
  const res = await fetchApi<{ data: PortfolioSnapshot[] }>(
    `/api/wallets/${encodeURIComponent(stakeAddress)}/history`,
  );
  return res.data;
}

export async function trackWallet(stakeAddress: string, label?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stakeAddress, label }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

// -- Profiler --

export interface ProfileData {
  address: string;
  stakeAddress: string | null;
  totalValueAda: string;
  holdings: Array<{
    asset: string;
    quantity: string;
    valueAda: string;
    ticker: string | null;
    name: string | null;
    decimals: number;
  }>;
  activity: Array<{
    txHash: string;
    dex: string;
    assetIn: string;
    amountIn: string;
    assetOut: string;
    amountOut: string;
    timestamp: number;
  }>;
}

export async function fetchProfile(address: string): Promise<ProfileData> {
  const res = await fetchApi<{ data: ProfileData }>(`/api/profiler/${encodeURIComponent(address)}`);
  return res.data;
}

// -- Alerts --

export interface AlertRuleData {
  id: string;
  type: string;
  asset: string | null;
  condition: Record<string, unknown>;
  channels: string[];
  enabled: boolean;
  createdAt: number;
}

export async function fetchAlerts(userId?: string): Promise<AlertRuleData[]> {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  const res = await fetchApi<{ data: AlertRuleData[] }>(`/api/alerts${params}`);
  return res.data;
}

export async function createAlert(alert: {
  userId: string;
  type: string;
  asset: string;
  condition: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alert),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function deleteAlert(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/alerts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}
