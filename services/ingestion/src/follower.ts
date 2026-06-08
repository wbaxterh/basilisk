/**
 * Block follower — polls the chain data provider for new blocks,
 * ingests them with all transactions, and updates the sync cursor.
 */

import type { ChainDataProvider } from "@basilisk/chain-data";
import type { Logger } from "@basilisk/shared";
import {
  type Sql,
  upsertBlock,
  insertTransaction,
  getLastSlot,
  setLastSlot,
  getLastHeight,
} from "./db.js";

export interface FollowerConfig {
  /** Polling interval in milliseconds when caught up to tip. */
  pollIntervalMs: number;
  /** Max blocks to process per batch before yielding. */
  batchSize: number;
}

const DEFAULT_CONFIG: FollowerConfig = {
  pollIntervalMs: 20_000, // Cardano block time ~20s
  batchSize: 100,
};

/**
 * Start the block follower loop.
 * Returns an abort function to stop the loop gracefully.
 */
export function startFollower(
  provider: ChainDataProvider,
  sql: Sql,
  log: Logger,
  config: Partial<FollowerConfig> = {},
): { stop: () => void } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const state = { running: true };

  const loop = async () => {
    log.info("block follower starting", { provider: provider.name });

    while (state.running) {
      try {
        await ingestNewBlocks(provider, sql, log, cfg, state);
      } catch (err) {
        log.error("follower error, will retry", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      if (state.running) {
        await sleep(cfg.pollIntervalMs);
      }
    }

    log.info("block follower stopped");
  };

  // Fire and forget — the loop runs until stop() is called.
  loop();

  return {
    stop: () => {
      state.running = false;
    },
  };
}

/**
 * Ingest all blocks from lastSlot+1 to the current chain tip.
 */
async function ingestNewBlocks(
  provider: ChainDataProvider,
  sql: Sql,
  log: Logger,
  cfg: FollowerConfig,
  state: { running: boolean },
): Promise<void> {
  const tip = await provider.getTip();
  const lastSlot = await getLastSlot(sql);

  if (lastSlot >= tip.slot) {
    log.debug("at tip, nothing to ingest", { slot: tip.slot, height: tip.height });
    return;
  }

  log.info("catching up", {
    lastSlot,
    tipSlot: tip.slot,
    tipHeight: tip.height,
  });

  // Walk forward by block height (not slot — Blockfrost API takes height, not slot).
  const lastHeight = await getLastHeight(sql);
  let currentHeight: number;
  if (lastHeight === 0) {
    // Fresh start — begin from recent blocks.
    currentHeight = Math.max(0, tip.height - 10);
    log.info("fresh start, beginning from recent blocks", { startHeight: currentHeight });
  } else {
    currentHeight = lastHeight + 1;
  }

  let processed = 0;

  while (currentHeight <= tip.height && processed < cfg.batchSize && state.running) {
    try {
      const block = await provider.getBlock(currentHeight);

      // Persist the block.
      await upsertBlock(sql, block);

      // Fetch and persist all transactions in the block.
      if (block.txCount > 0) {
        const txHashes = await provider.getBlockTransactions(block.hash);

        for (const txHash of txHashes) {
          const tx = await provider.getTransaction(txHash);
          await insertTransaction(sql, tx);
        }
      }

      // Update sync cursor.
      await setLastSlot(sql, block.slot);

      log.info("block ingested", {
        height: block.height,
        slot: block.slot,
        txCount: block.txCount,
        hash: block.hash.slice(0, 16) + "...",
      });

      currentHeight++;
      processed++;
    } catch (err) {
      // If a specific block fails (e.g., doesn't exist yet), break and retry later.
      log.warn("block fetch failed, will retry next cycle", {
        height: currentHeight,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  if (processed > 0) {
    log.info("batch complete", { blocksProcessed: processed });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
