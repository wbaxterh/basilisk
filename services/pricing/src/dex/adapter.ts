/**
 * DexAdapter — interface for decoding swaps from transactions.
 * Each DEX (Minswap, SundaeSwap, etc.) implements this interface.
 */

import type { Transaction, DexSwap, DexId } from "@basilisk/shared";

export interface DexAdapter {
  /** Which DEX this adapter handles. */
  readonly dexId: DexId;

  /** Known script/contract addresses for this DEX. */
  readonly scriptAddresses: Set<string>;

  /**
   * Attempt to decode swap events from a transaction.
   * Returns empty array if the tx doesn't interact with this DEX.
   */
  decodeSwaps(tx: Transaction): DexSwap[];
}
