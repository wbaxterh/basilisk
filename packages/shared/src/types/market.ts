/**
 * Market/pricing types — DEX swaps, VWAP prices, OHLCV candles, token metadata.
 * These power the pricing engine (services/pricing) and the charts UI.
 */

import type { AssetUnit } from "./chain.js";

/** A decoded DEX swap event extracted from a transaction. */
export interface DexSwap {
  /** Transaction hash containing this swap. */
  txHash: string;
  /** DEX identifier (e.g. "minswap", "sundaeswap", "wingriders"). */
  dex: DexId;
  /** The asset being sold (input side). */
  assetIn: AssetUnit;
  /** Amount of assetIn sold (raw units as string). */
  amountIn: string;
  /** The asset being bought (output side). */
  assetOut: AssetUnit;
  /** Amount of assetOut received (raw units as string). */
  amountOut: string;
  /** Sender address (if resolvable). */
  senderAddress?: string;
  /** Unix timestamp (from block). */
  timestamp: number;
  /** Slot number. */
  slot: number;
  /** Pool identifier (address or NFT). */
  poolId: string;
}

/** Supported DEX identifiers. Extend as we add adapters. */
export type DexId =
  | "minswap"
  | "sundaeswap"
  | "wingriders"
  | "muesliswap"
  | "vyfinance"
  | "spectrum";

/** VWAP price point for a token at a point in time. */
export interface PricePoint {
  /** The token (AssetUnit). */
  asset: AssetUnit;
  /** Price denominated in ADA (lovelace per token unit). */
  priceAda: string;
  /** Price denominated in USD (if ADA/USD oracle available). */
  priceUsd?: string;
  /** Volume used to compute this VWAP (in ADA). */
  volumeAda: string;
  /** Unix timestamp. */
  timestamp: number;
}

/** An OHLCV candle for a given time interval. */
export interface OhlcvCandle {
  /** The token (AssetUnit). */
  asset: AssetUnit;
  /** Candle interval. */
  interval: CandleInterval;
  /** Candle open time (unix timestamp). */
  openTime: number;
  /** Candle close time (unix timestamp). */
  closeTime: number;
  /** Open price (ADA). */
  open: string;
  /** High price (ADA). */
  high: string;
  /** Low price (ADA). */
  low: string;
  /** Close price (ADA). */
  close: string;
  /** Volume in ADA. */
  volumeAda: string;
  /** Number of trades in this candle. */
  tradeCount: number;
}

/** Supported candle intervals. */
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

/** All supported intervals as an array, for iteration. */
export const CANDLE_INTERVALS: CandleInterval[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];

/** Interval durations in seconds. */
export const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** Token metadata — display info for a Cardano native asset. */
export interface TokenMetadata {
  /** The token (AssetUnit). */
  asset: AssetUnit;
  /** Policy ID. */
  policyId: string;
  /** Asset name (hex). */
  assetName: string;
  /** Human-readable ticker (e.g. "MIN", "SUNDAE"). */
  ticker?: string;
  /** Full name (e.g. "Minswap"). */
  name?: string;
  /** Decimal places for display. */
  decimals: number;
  /** Logo URL (from token registry or CIP-68). */
  logoUrl?: string;
  /** Project description. */
  description?: string;
  /** Project website. */
  website?: string;
  /** When we last refreshed this metadata. */
  updatedAt: number;
}
