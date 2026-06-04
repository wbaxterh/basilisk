/**
 * DEX swap / trade history endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function swapRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/swaps/:asset — recent swaps for a token. */
  app.get("/api/swaps/:asset", async (req) => {
    const { asset } = req.params as { asset: string };
    const query = req.query as { limit?: string; dex?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    let rows;
    if (query.dex) {
      rows = await sql`
        SELECT tx_hash, dex, asset_in, amount_in, asset_out, amount_out,
               sender_address, pool_id, slot,
               EXTRACT(EPOCH FROM timestamp)::int AS timestamp
        FROM dex_swaps
        WHERE (asset_in = ${asset} OR asset_out = ${asset})
          AND dex = ${query.dex}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT tx_hash, dex, asset_in, amount_in, asset_out, amount_out,
               sender_address, pool_id, slot,
               EXTRACT(EPOCH FROM timestamp)::int AS timestamp
        FROM dex_swaps
        WHERE asset_in = ${asset} OR asset_out = ${asset}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
    }

    return {
      data: rows.map((r) => ({
        txHash: r.tx_hash,
        dex: r.dex,
        assetIn: r.asset_in,
        amountIn: r.amount_in,
        assetOut: r.asset_out,
        amountOut: r.amount_out,
        senderAddress: r.sender_address,
        poolId: r.pool_id,
        slot: r.slot,
        timestamp: r.timestamp,
      })),
    };
  });
}
