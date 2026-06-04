/**
 * @basilisk/pricing
 * DEX swap decoder + VWAP pricing engine + OHLCV candle builder.
 *
 * This service:
 * 1. Reads new transactions from the database (written by ingestion).
 * 2. Decodes DEX swap events using protocol-specific adapters.
 * 3. Persists decoded swaps.
 * 4. Computes VWAP prices and OHLCV candles.
 *
 * Owns: EPIC-0 (US-0.3, US-0.4, US-0.5)
 */

import { createLogger, loadConfig, CANDLE_INTERVALS } from "@basilisk/shared";
import type { Transaction, CandleInterval } from "@basilisk/shared";
import { createDb, insertSwap, upsertPrice, upsertCandle } from "./db.js";
import { createAdapters } from "./dex/index.js";
import { computeVwap } from "./vwap.js";
import { buildCandles } from "./candles.js";
import type { Sql } from "./db.js";

const log = createLogger("pricing");

/** How often to poll for new transactions (ms). */
const POLL_INTERVAL_MS = 10_000;

/** VWAP window — compute from swaps in the last N seconds. */
const VWAP_WINDOW_SECONDS = 3600; // 1 hour

async function main(): Promise<void> {
  log.info("initializing pricing service");

  const config = loadConfig("databaseUrl", "logLevel");
  const sql = createDb(config.databaseUrl);
  const adapters = createAdapters();

  log.info("loaded DEX adapters", {
    adapters: adapters.map((a) => a.dexId),
  });

  let lastProcessedSlot = 0;
  let running = true;

  const shutdown = async () => {
    log.info("shutting down...");
    running = false;
    await sql.end();
    log.info("goodbye");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    try {
      // Fetch unprocessed transactions.
      const txRows = await sql`
        SELECT hash, block_hash, block_height, slot, block_index,
               EXTRACT(EPOCH FROM timestamp)::int AS timestamp,
               fees, metadata
        FROM transactions
        WHERE slot > ${lastProcessedSlot}
        ORDER BY slot ASC, block_index ASC
        LIMIT 500
      `;

      if (txRows.length > 0) {
        const trackedAssets = new Set<string>();

        for (const row of txRows) {
          const tx: Transaction = {
            hash: row.hash as string,
            blockHash: row.block_hash as string,
            blockHeight: row.block_height as number,
            slot: row.slot as number,
            blockIndex: row.block_index as number,
            timestamp: row.timestamp as number,
            fees: String(row.fees),
            inputs: [],  // Inputs/outputs not stored in tx table — decoded from chain data.
            outputs: [],
            metadata: row.metadata as Record<string, unknown> | undefined,
          };

          // Try each DEX adapter.
          for (const adapter of adapters) {
            const swaps = adapter.decodeSwaps(tx);
            for (const swap of swaps) {
              await insertSwap(sql, swap);
              trackedAssets.add(swap.assetIn);
              trackedAssets.add(swap.assetOut);

              log.info("swap decoded", {
                dex: swap.dex,
                assetIn: swap.assetIn.slice(0, 20) + "...",
                assetOut: swap.assetOut.slice(0, 20) + "...",
                txHash: swap.txHash.slice(0, 16) + "...",
              });
            }
          }

          lastProcessedSlot = row.slot as number;
        }

        // Recompute VWAP + candles for assets seen in this batch.
        await updatePricesAndCandles(sql, trackedAssets);

        log.info("batch processed", {
          transactions: txRows.length,
          lastSlot: lastProcessedSlot,
        });
      }
    } catch (err) {
      log.error("processing error, will retry", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** Recompute VWAP and candles for a set of assets. */
async function updatePricesAndCandles(
  sql: Sql,
  assets: Set<string>,
): Promise<void> {
  // Filter out lovelace — we don't need a price for ADA in ADA.
  const tokenAssets = [...assets].filter((a) => a !== "lovelace");

  for (const asset of tokenAssets) {
    try {
      // Fetch recent swaps for VWAP.
      const swaps = await sql`
        SELECT tx_hash, dex, asset_in, amount_in, asset_out, amount_out,
               sender_address, pool_id, slot,
               EXTRACT(EPOCH FROM timestamp)::int AS timestamp
        FROM dex_swaps
        WHERE (asset_in = ${asset} OR asset_out = ${asset})
          AND timestamp > NOW() - INTERVAL '1 second' * ${VWAP_WINDOW_SECONDS}
        ORDER BY timestamp ASC
      `;

      const dexSwaps = swaps.map((r) => ({
        txHash: r.tx_hash as string,
        dex: r.dex as "minswap",
        assetIn: r.asset_in as string,
        amountIn: r.amount_in as string,
        assetOut: r.asset_out as string,
        amountOut: r.amount_out as string,
        senderAddress: (r.sender_address as string) ?? undefined,
        poolId: r.pool_id as string,
        slot: r.slot as number,
        timestamp: r.timestamp as number,
      }));

      // Compute and persist VWAP.
      const vwap = computeVwap(asset, dexSwaps);
      if (vwap) {
        await upsertPrice(sql, vwap);
      }

      // Build and persist candles at each interval.
      for (const interval of CANDLE_INTERVALS) {
        const candles = buildCandles(asset, dexSwaps, interval as CandleInterval);
        for (const candle of candles) {
          await upsertCandle(sql, candle);
        }
      }
    } catch (err) {
      log.warn("failed to update prices for asset", {
        asset: asset.slice(0, 20) + "...",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

main().catch((err) => {
  log.error("fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
