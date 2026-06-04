/**
 * Ogmios WebSocket chain-sync — streams blocks in real-time.
 *
 * Replaces the polling approach in follower.ts with push-based
 * chain-sync protocol. Handles rollForward and rollBackward events.
 *
 * See ADR-001 and issue #51.
 */

import {
  createInteractionContext,
  createChainSynchronizationClient,
  type ConnectionConfig,
} from "@cardano-ogmios/client";
import type { Logger } from "@basilisk/shared";
import {
  type Sql,
  upsertBlock,
  insertTransaction,
  setLastSlot,
  setLastBlockHash,
  rollbackFromSlot,
  getLastSlot,
} from "./db.js";

export interface ChainSyncConfig {
  ogmiosHost: string;
  ogmiosPort: number;
  ogmiosTls?: boolean;
}

/**
 * Start streaming chain-sync via Ogmios WebSocket.
 * Returns a stop function for graceful shutdown.
 */
export async function startChainSync(
  sql: Sql,
  log: Logger,
  config: ChainSyncConfig,
): Promise<{ stop: () => Promise<void> }> {
  const connectionConfig: ConnectionConfig = {
    host: config.ogmiosHost,
    port: config.ogmiosPort,
    tls: config.ogmiosTls ?? false,
  };

  log.info("connecting to Ogmios for chain-sync", {
    host: config.ogmiosHost,
    port: config.ogmiosPort,
  });

  const context = await createInteractionContext(
    (err) => {
      log.error("ogmios websocket error", { error: err.message });
    },
    (code, reason) => {
      log.warn("ogmios websocket closed", { code, reason });
    },
    { connection: connectionConfig },
  );

  // Determine the intersection point (where to resume from).
  const lastSlot = await getLastSlot(sql);
  const intersectionPoint = lastSlot > 0
    ? [{ slot: lastSlot, id: "" }] // Ogmios will find the nearest valid point
    : "origin";

  let blockCount = 0;

  const client = await createChainSynchronizationClient(context, {
    rollForward: async ({ block }, requestNext) => {
      try {
        if (block && "id" in block) {
          const b = block as {
            id: string;
            height: number;
            slot: number;
            ancestor: string;
            size: { bytes: number };
            transactions?: Array<{
              id: string;
              fee?: { ada: { lovelace: number } };
              inputs?: Array<{ transaction: { id: string }; index: number }>;
              outputs?: Array<{ address: string; value: { ada: { lovelace: number } } }>;
            }>;
          };

          // Persist block.
          await upsertBlock(sql, {
            hash: b.id,
            slot: b.slot,
            height: b.height,
            timestamp: Math.floor(Date.now() / 1000), // Ogmios doesn't always include timestamp
            txCount: b.transactions?.length ?? 0,
            epoch: 0, // Computed from slot in production
            fees: "0",
          });

          // Persist transactions.
          if (b.transactions) {
            for (let i = 0; i < b.transactions.length; i++) {
              const tx = b.transactions[i]!;
              await insertTransaction(sql, {
                hash: tx.id,
                blockHash: b.id,
                blockHeight: b.height,
                slot: b.slot,
                blockIndex: i,
                timestamp: Math.floor(Date.now() / 1000),
                fees: tx.fee ? String(tx.fee.ada.lovelace) : "0",
                inputs: [],
                outputs: [],
              });
            }
          }

          // Update sync cursor.
          await setLastSlot(sql, b.slot);
          await setLastBlockHash(sql, b.id);

          blockCount++;
          if (blockCount % 100 === 0) {
            log.info("chain-sync progress", {
              height: b.height,
              slot: b.slot,
              blocksIngested: blockCount,
            });
          }
        }
      } catch (err) {
        log.error("rollForward error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      requestNext();
    },

    rollBackward: async ({ point }, requestNext) => {
      try {
        if (point !== "origin" && "slot" in point) {
          const slot = point.slot;
          log.warn("chain rollback", { toSlot: slot });

          const deleted = await rollbackFromSlot(sql, slot + 1);
          await setLastSlot(sql, slot);

          log.info("rollback complete", { deletedBlocks: deleted, newTipSlot: slot });
        } else {
          log.warn("rollback to origin");
          await rollbackFromSlot(sql, 0);
          await setLastSlot(sql, 0);
        }
      } catch (err) {
        log.error("rollBackward error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      requestNext();
    },
  });

  // Start syncing from intersection.
  if (intersectionPoint === "origin") {
    await client.resume(["origin"]);
  } else {
    await client.resume(intersectionPoint);
  }

  log.info("chain-sync started", {
    fromSlot: lastSlot,
    mode: intersectionPoint === "origin" ? "from origin" : "from cursor",
  });

  return {
    stop: async () => {
      log.info("stopping chain-sync...");
      await client.shutdown();
      (context.socket as unknown as { close(): void }).close();
      log.info("chain-sync stopped", { totalBlocks: blockCount });
    },
  };
}
