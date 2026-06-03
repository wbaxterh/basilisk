/**
 * Database layer for the pricing service.
 */

import postgres from "postgres";
import type { DexSwap, PricePoint, OhlcvCandle } from "@basilisk/shared";

export type Sql = postgres.Sql;

export function createDb(connectionString: string): Sql {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/** Insert a decoded DEX swap. */
export async function insertSwap(sql: Sql, swap: DexSwap): Promise<void> {
  await sql`
    INSERT INTO dex_swaps (tx_hash, dex, asset_in, amount_in, asset_out, amount_out, sender_address, pool_id, slot, timestamp)
    VALUES (
      ${swap.txHash},
      ${swap.dex},
      ${swap.assetIn},
      ${swap.amountIn},
      ${swap.assetOut},
      ${swap.amountOut},
      ${swap.senderAddress ?? null},
      ${swap.poolId},
      ${swap.slot},
      ${new Date(swap.timestamp * 1000).toISOString()}
    )
    ON CONFLICT (tx_hash, dex, pool_id) DO NOTHING
  `;
}

/** Insert or update a VWAP price point. */
export async function upsertPrice(sql: Sql, price: PricePoint): Promise<void> {
  await sql`
    INSERT INTO prices (asset, price_ada, price_usd, volume_ada, timestamp)
    VALUES (
      ${price.asset},
      ${price.priceAda},
      ${price.priceUsd ?? null},
      ${price.volumeAda},
      ${new Date(price.timestamp * 1000).toISOString()}
    )
    ON CONFLICT (asset, timestamp)
    DO UPDATE SET price_ada = ${price.priceAda}, volume_ada = ${price.volumeAda}
  `;
}

/** Insert or update an OHLCV candle. */
export async function upsertCandle(sql: Sql, candle: OhlcvCandle): Promise<void> {
  await sql`
    INSERT INTO ohlcv (asset, interval, open_time, close_time, open, high, low, close, volume_ada, trade_count)
    VALUES (
      ${candle.asset},
      ${candle.interval},
      ${new Date(candle.openTime * 1000).toISOString()},
      ${new Date(candle.closeTime * 1000).toISOString()},
      ${candle.open},
      ${candle.high},
      ${candle.low},
      ${candle.close},
      ${candle.volumeAda},
      ${candle.tradeCount}
    )
    ON CONFLICT (asset, interval, open_time)
    DO UPDATE SET
      high = GREATEST(ohlcv.high, ${candle.high}),
      low = LEAST(ohlcv.low, ${candle.low}),
      close = ${candle.close},
      volume_ada = ${candle.volumeAda},
      trade_count = ${candle.tradeCount}
  `;
}

/** Fetch recent swaps for an asset from the database. */
export async function getRecentSwaps(
  sql: Sql,
  asset: string,
  windowSeconds: number,
): Promise<DexSwap[]> {
  const rows = await sql`
    SELECT tx_hash, dex, asset_in, amount_in, asset_out, amount_out,
           sender_address, pool_id, slot,
           EXTRACT(EPOCH FROM timestamp)::int AS timestamp
    FROM dex_swaps
    WHERE (asset_in = ${asset} OR asset_out = ${asset})
      AND timestamp > NOW() - INTERVAL '1 second' * ${windowSeconds}
    ORDER BY timestamp ASC
  `;

  return rows.map((r) => ({
    txHash: r.tx_hash as string,
    dex: r.dex as DexSwap["dex"],
    assetIn: r.asset_in as string,
    amountIn: r.amount_in as string,
    assetOut: r.asset_out as string,
    amountOut: r.amount_out as string,
    senderAddress: (r.sender_address as string) ?? undefined,
    poolId: r.pool_id as string,
    slot: r.slot as number,
    timestamp: r.timestamp as number,
  }));
}
