/**
 * VWAP (Volume-Weighted Average Price) calculator.
 *
 * Computes VWAP from a set of DEX swaps for a given asset.
 * VWAP = Σ(price_i × volume_i) / Σ(volume_i)
 *
 * For Cardano, all prices are denominated in ADA (lovelace).
 * A swap of Token→ADA gives us a direct price.
 * A swap of ADA→Token also gives us a direct price (inverse).
 */

import type { DexSwap, PricePoint } from "@basilisk/shared";

const LOVELACE = "lovelace";

/**
 * Compute VWAP for a specific asset from a set of swaps.
 * Only considers swaps where one side is ADA (lovelace).
 *
 * @param asset - The asset unit to compute VWAP for.
 * @param swaps - Recent swap events involving this asset.
 * @returns PricePoint or null if no valid swaps.
 */
export function computeVwap(
  asset: string,
  swaps: DexSwap[],
): PricePoint | null {
  let weightedSum = 0;
  let totalVolume = 0;
  let latestTimestamp = 0;

  for (const swap of swaps) {
    const price = extractAdaPrice(asset, swap);
    if (price === null) continue;

    const volume = price.volumeAda;
    weightedSum += price.priceAda * volume;
    totalVolume += volume;

    if (swap.timestamp > latestTimestamp) {
      latestTimestamp = swap.timestamp;
    }
  }

  if (totalVolume === 0) return null;

  const vwap = weightedSum / totalVolume;

  return {
    asset,
    priceAda: vwap.toFixed(10),
    volumeAda: totalVolume.toFixed(0),
    timestamp: latestTimestamp,
  };
}

/**
 * Extract ADA-denominated price from a single swap.
 * Returns null if the swap doesn't involve ADA on one side.
 */
function extractAdaPrice(
  asset: string,
  swap: DexSwap,
): { priceAda: number; volumeAda: number } | null {
  if (swap.assetIn === asset && swap.assetOut === LOVELACE) {
    // User sold asset for ADA: price = ADA received / tokens sold
    const tokensIn = Number(swap.amountIn);
    const adaOut = Number(swap.amountOut);
    if (tokensIn === 0) return null;
    return {
      priceAda: adaOut / tokensIn,
      volumeAda: adaOut,
    };
  }

  if (swap.assetIn === LOVELACE && swap.assetOut === asset) {
    // User bought asset with ADA: price = ADA spent / tokens received
    const adaIn = Number(swap.amountIn);
    const tokensOut = Number(swap.amountOut);
    if (tokensOut === 0) return null;
    return {
      priceAda: adaIn / tokensOut,
      volumeAda: adaIn,
    };
  }

  // Swap doesn't involve ADA — can't compute direct price.
  return null;
}
