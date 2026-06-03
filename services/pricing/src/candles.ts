/**
 * OHLCV candle builder.
 *
 * Aggregates swap events into OHLCV candles at various time intervals.
 * Each candle covers a fixed time window (1m, 5m, 15m, 1h, 4h, 1d).
 */

import type { DexSwap, OhlcvCandle, CandleInterval } from "@basilisk/shared";
import { INTERVAL_SECONDS } from "@basilisk/shared";

const LOVELACE = "lovelace";

/**
 * Build OHLCV candles from a set of swaps for a given asset and interval.
 *
 * @param asset - The asset to build candles for.
 * @param swaps - Swap events sorted by timestamp ascending.
 * @param interval - The candle interval (e.g., "1m", "5m", "1h").
 * @returns Array of OHLCV candles, sorted by open_time ascending.
 */
export function buildCandles(
  asset: string,
  swaps: DexSwap[],
  interval: CandleInterval,
): OhlcvCandle[] {
  const intervalSec = INTERVAL_SECONDS[interval];
  const buckets = new Map<number, SwapAccumulator>();

  for (const swap of swaps) {
    const price = extractPrice(asset, swap);
    if (price === null) continue;

    // Bucket by interval start time.
    const bucketTime = Math.floor(swap.timestamp / intervalSec) * intervalSec;

    let acc = buckets.get(bucketTime);
    if (!acc) {
      acc = {
        open: price.priceAda,
        high: price.priceAda,
        low: price.priceAda,
        close: price.priceAda,
        volumeAda: 0,
        tradeCount: 0,
        firstTimestamp: swap.timestamp,
        lastTimestamp: swap.timestamp,
      };
      buckets.set(bucketTime, acc);
    }

    // Update OHLCV.
    if (swap.timestamp < acc.firstTimestamp) {
      acc.open = price.priceAda;
      acc.firstTimestamp = swap.timestamp;
    }
    if (swap.timestamp > acc.lastTimestamp) {
      acc.close = price.priceAda;
      acc.lastTimestamp = swap.timestamp;
    }
    if (price.priceAda > acc.high) acc.high = price.priceAda;
    if (price.priceAda < acc.low) acc.low = price.priceAda;
    acc.volumeAda += price.volumeAda;
    acc.tradeCount++;
  }

  // Convert buckets to candles, sorted by time.
  const candles: OhlcvCandle[] = [];
  const sortedTimes = [...buckets.keys()].sort((a, b) => a - b);

  for (const openTime of sortedTimes) {
    const acc = buckets.get(openTime)!;
    candles.push({
      asset,
      interval,
      openTime,
      closeTime: openTime + intervalSec,
      open: acc.open.toFixed(10),
      high: acc.high.toFixed(10),
      low: acc.low.toFixed(10),
      close: acc.close.toFixed(10),
      volumeAda: acc.volumeAda.toFixed(0),
      tradeCount: acc.tradeCount,
    });
  }

  return candles;
}

interface SwapAccumulator {
  open: number;
  high: number;
  low: number;
  close: number;
  volumeAda: number;
  tradeCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

/** Extract ADA price from a swap (same logic as VWAP). */
function extractPrice(
  asset: string,
  swap: DexSwap,
): { priceAda: number; volumeAda: number } | null {
  if (swap.assetIn === asset && swap.assetOut === LOVELACE) {
    const tokensIn = Number(swap.amountIn);
    const adaOut = Number(swap.amountOut);
    if (tokensIn === 0) return null;
    return { priceAda: adaOut / tokensIn, volumeAda: adaOut };
  }

  if (swap.assetIn === LOVELACE && swap.assetOut === asset) {
    const adaIn = Number(swap.amountIn);
    const tokensOut = Number(swap.amountOut);
    if (tokensOut === 0) return null;
    return { priceAda: adaIn / tokensOut, volumeAda: adaIn };
  }

  return null;
}
