/**
 * Block and chain status endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function blockRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/blocks/latest — latest ingested blocks. */
  app.get("/api/blocks/latest", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "10", 10), 100);

    const rows = await sql`
      SELECT hash, slot, height, epoch, tx_count, fees,
             EXTRACT(EPOCH FROM timestamp)::int AS timestamp
      FROM blocks
      ORDER BY height DESC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r) => ({
        hash: r.hash,
        slot: r.slot,
        height: r.height,
        epoch: r.epoch,
        txCount: r.tx_count,
        fees: r.fees,
        timestamp: r.timestamp,
      })),
    };
  });

  /** GET /api/stats — network statistics summary. */
  app.get("/api/stats", async () => {
    const [tipRows, txCountRows, swapVolumeRows] = await Promise.all([
      sql`SELECT height, slot, epoch, EXTRACT(EPOCH FROM timestamp)::int AS timestamp FROM blocks ORDER BY height DESC LIMIT 1`,
      sql`SELECT COUNT(*)::int AS count FROM transactions WHERE timestamp > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COALESCE(SUM(CASE WHEN asset_in = 'lovelace' THEN amount_in::numeric WHEN asset_out = 'lovelace' THEN amount_out::numeric ELSE 0 END), 0) AS volume_lovelace FROM dex_swaps WHERE timestamp > NOW() - INTERVAL '24 hours'`,
    ]);

    const tip = tipRows[0];
    const txCount = txCountRows[0];
    const swapVolume = swapVolumeRows[0];

    return {
      data: {
        latestBlock: tip
          ? { height: tip.height, slot: tip.slot, epoch: tip.epoch, timestamp: tip.timestamp }
          : null,
        transactions24h: txCount?.count ?? 0,
        dexVolumeLovelace24h: swapVolume?.volume_lovelace ?? "0",
      },
    };
  });
}
