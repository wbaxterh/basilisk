/**
 * Database layer for the ingestion service.
 * Uses the `postgres` driver (no ORM — direct SQL for performance).
 */

import postgres from "postgres";
import type { Block, Transaction } from "@basilisk/shared";

export type Sql = postgres.Sql;

export function createDb(connectionString: string): Sql {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/** Upsert a block into the blocks table. */
export async function upsertBlock(sql: Sql, block: Block): Promise<void> {
  await sql`
    INSERT INTO blocks (hash, slot, height, epoch, timestamp, tx_count, fees)
    VALUES (
      ${block.hash},
      ${block.slot},
      ${block.height},
      ${block.epoch},
      ${new Date(block.timestamp * 1000).toISOString()},
      ${block.txCount},
      ${block.fees}
    )
    ON CONFLICT (hash) DO NOTHING
  `;
}

/** Insert a transaction into the transactions table. */
export async function insertTransaction(sql: Sql, tx: Transaction): Promise<void> {
  await sql`
    INSERT INTO transactions (hash, block_hash, block_height, slot, block_index, timestamp, fees, metadata)
    VALUES (
      ${tx.hash},
      ${tx.blockHash},
      ${tx.blockHeight},
      ${tx.slot},
      ${tx.blockIndex},
      ${new Date(tx.timestamp * 1000).toISOString()},
      ${tx.fees},
      ${tx.metadata ? JSON.stringify(tx.metadata) : null}
    )
    ON CONFLICT (hash) DO NOTHING
  `;
}

/** Get the last ingested slot from sync_state. */
export async function getLastSlot(sql: Sql): Promise<number> {
  const rows = await sql`
    SELECT value FROM sync_state WHERE key = 'last_slot'
  `;
  if (rows.length === 0) return 0;
  return parseInt(rows[0]!.value as string, 10);
}

/** Update the last ingested slot in sync_state. */
export async function setLastSlot(sql: Sql, slot: number): Promise<void> {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('last_slot', ${String(slot)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${String(slot)}, updated_at = NOW()
  `;
}

/** Delete all blocks and transactions at or after the given slot (for rollback). */
export async function rollbackFromSlot(sql: Sql, slot: number): Promise<number> {
  // Delete transactions first (FK to blocks).
  await sql`DELETE FROM transactions WHERE slot >= ${slot}`;
  const result = await sql`DELETE FROM blocks WHERE slot >= ${slot}`;
  return result.count;
}

/** Get the last block hash from sync_state. */
export async function getLastBlockHash(sql: Sql): Promise<string | null> {
  const rows = await sql`SELECT value FROM sync_state WHERE key = 'last_block_hash'`;
  if (rows.length === 0) return null;
  return rows[0]!.value as string;
}

/** Set the last block hash in sync_state. */
export async function setLastBlockHash(sql: Sql, hash: string): Promise<void> {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('last_block_hash', ${hash}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${hash}, updated_at = NOW()
  `;
}
