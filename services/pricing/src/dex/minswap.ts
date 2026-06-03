/**
 * Minswap DEX adapter — decodes swap events from Minswap V2 transactions.
 *
 * Minswap V2 uses a constant-product AMM. Swaps interact with pool UTxOs
 * held at known script addresses. We identify swaps by matching output
 * addresses against the known Minswap pool script hash.
 *
 * Pool identification: Minswap pools hold an LP NFT whose policy ID is
 * known. The pool UTxO contains two assets (the trading pair) plus ADA.
 *
 * Swap detection heuristic:
 * 1. Tx has an input from a known Minswap pool address.
 * 2. Tx has an output back to the same pool address.
 * 3. The difference in asset quantities between the pool input and pool output
 *    tells us what was swapped.
 */

import type { Transaction, DexSwap, TxInput, TxOutput } from "@basilisk/shared";
import { toAssetUnit } from "@basilisk/shared";
import type { DexAdapter } from "./adapter.js";

/**
 * Minswap V2 mainnet constants.
 * These are the well-known addresses for the Minswap V2 order/pool contracts.
 */
const MINSWAP_V2_POOL_SCRIPT =
  "addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha";

const MINSWAP_ORDER_ADDRESSES = new Set([
  // Minswap V2 order contract (mainnet)
  "addr1wyx22z2s4kasd3w976pnjf9xdty88epjqfvgkmfnce7a4jgz6720s",
]);

// ADA is represented as "lovelace" in our system.
const LOVELACE = "lovelace";

export class MinswapAdapter implements DexAdapter {
  readonly dexId = "minswap" as const;

  readonly scriptAddresses = new Set([
    MINSWAP_V2_POOL_SCRIPT,
    ...MINSWAP_ORDER_ADDRESSES,
  ]);

  decodeSwaps(tx: Transaction): DexSwap[] {
    const swaps: DexSwap[] = [];

    // Find pool inputs and outputs.
    const poolInputs = tx.inputs.filter((inp) =>
      inp.address !== undefined && this.scriptAddresses.has(inp.address),
    );
    const poolOutputs = tx.outputs.filter((out) =>
      this.scriptAddresses.has(out.address),
    );

    if (poolInputs.length === 0 || poolOutputs.length === 0) {
      return swaps;
    }

    // For each pool interaction, compute the swap by diffing assets.
    for (const poolInput of poolInputs) {
      const poolOutput = poolOutputs.find(
        (out) => out.address === poolInput.address,
      );
      if (!poolOutput) continue;

      const swap = this.computeSwapFromDiff(
        poolInput,
        poolOutput,
        tx,
      );
      if (swap) {
        swaps.push(swap);
      }
    }

    return swaps;
  }

  /**
   * Compute a swap by comparing pool UTxO before (input) and after (output).
   * The asset that increased went INTO the pool (user sold).
   * The asset that decreased came OUT of the pool (user bought).
   */
  private computeSwapFromDiff(
    poolInput: TxInput,
    poolOutput: TxOutput,
    tx: Transaction,
  ): DexSwap | null {
    // Build asset balance maps for input and output.
    const inputBalances = this.getBalances(poolInput);
    const outputBalances = this.getBalances(poolOutput);

    // Find assets where the quantity changed.
    const allAssets = new Set([
      ...inputBalances.keys(),
      ...outputBalances.keys(),
    ]);

    let assetIn: string | undefined;
    let amountIn = 0n;
    let assetOut: string | undefined;
    let amountOut = 0n;

    for (const asset of allAssets) {
      const before = inputBalances.get(asset) ?? 0n;
      const after = outputBalances.get(asset) ?? 0n;
      const diff = after - before;

      if (diff > 0n && (assetIn === undefined || diff > amountIn)) {
        // Pool received more of this asset → user sold it.
        assetIn = asset;
        amountIn = diff;
      } else if (diff < 0n) {
        const absDiff = -diff;
        if (assetOut === undefined || absDiff > amountOut) {
          // Pool lost this asset → user bought it.
          assetOut = asset;
          amountOut = absDiff;
        }
      }
    }

    if (!assetIn || !assetOut || amountIn === 0n || amountOut === 0n) {
      return null;
    }

    // Determine sender from non-pool inputs.
    const senderInput = tx.inputs.find(
      (inp) => inp.address !== undefined && !this.scriptAddresses.has(inp.address),
    );

    return {
      txHash: tx.hash,
      dex: "minswap",
      assetIn,
      amountIn: amountIn.toString(),
      assetOut,
      amountOut: amountOut.toString(),
      senderAddress: senderInput?.address,
      timestamp: tx.timestamp,
      slot: tx.slot,
      poolId: poolInput.address ?? poolOutput.address,
    };
  }

  /** Build a balance map from a UTxO (input or output). */
  private getBalances(utxo: TxInput | TxOutput): Map<string, bigint> {
    const balances = new Map<string, bigint>();

    // ADA balance.
    const adaAmount = utxo.amount ?? "0";
    balances.set(LOVELACE, BigInt(adaAmount));

    // Native asset balances.
    const assets = "assets" in utxo ? utxo.assets : undefined;
    if (assets) {
      for (const asset of assets) {
        const unit = toAssetUnit(asset.policyId, asset.assetName);
        const current = balances.get(unit) ?? 0n;
        balances.set(unit, current + BigInt(asset.quantity));
      }
    }

    return balances;
  }
}
