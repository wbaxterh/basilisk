/**
 * Database layer for the portfolio service.
 */

import postgres from "postgres";

export type Sql = postgres.Sql;

export function createDb(connectionString: string): Sql {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/** Get all tracked wallets. */
export async function getTrackedWallets(sql: Sql): Promise<{ id: string; stakeAddress: string }[]> {
  const rows = await sql`SELECT id, stake_address FROM wallets`;
  return rows.map((r) => ({ id: r.id as string, stakeAddress: r.stake_address as string }));
}

/** Upsert a holding for a wallet. */
export async function upsertHolding(
  sql: Sql,
  walletId: string,
  asset: string,
  quantity: string,
  valueAda: string,
  valueUsd: string | null,
): Promise<void> {
  await sql`
    INSERT INTO holdings (wallet_id, asset, quantity, value_ada, value_usd)
    VALUES (${walletId}, ${asset}, ${quantity}, ${valueAda}, ${valueUsd})
    ON CONFLICT (wallet_id, asset)
    DO UPDATE SET quantity = ${quantity}, value_ada = ${valueAda}, value_usd = ${valueUsd}
  `;
}

/** Delete all holdings for a wallet (before re-computing). */
export async function clearHoldings(sql: Sql, walletId: string): Promise<void> {
  await sql`DELETE FROM holdings WHERE wallet_id = ${walletId}`;
}

/** Insert a portfolio snapshot. */
export async function insertSnapshot(
  sql: Sql,
  walletId: string,
  totalValueAda: string,
  totalValueUsd: string | null,
  holdingsJson: unknown[],
): Promise<void> {
  await sql`
    INSERT INTO portfolio_snapshots (wallet_id, timestamp, total_value_ada, total_value_usd, holdings_json)
    VALUES (${walletId}, NOW(), ${totalValueAda}, ${totalValueUsd}, ${JSON.stringify(holdingsJson)})
  `;
}

/** Get the latest price for an asset. */
export async function getLatestPrice(sql: Sql, asset: string): Promise<{ priceAda: string } | null> {
  const rows = await sql`
    SELECT price_ada FROM prices WHERE asset = ${asset} ORDER BY timestamp DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { priceAda: rows[0]!.price_ada as string };
}
