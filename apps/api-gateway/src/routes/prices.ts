/**
 * Price endpoints — current VWAP prices for tokens.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function priceRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/prices — latest price for all tracked tokens. */
  app.get("/api/prices", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    const rows = await sql`
      SELECT DISTINCT ON (asset)
        asset, price_ada, price_usd, volume_ada,
        EXTRACT(EPOCH FROM timestamp)::int AS timestamp
      FROM prices
      ORDER BY asset, timestamp DESC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        priceAda: r.price_ada,
        priceUsd: r.price_usd,
        volumeAda: r.volume_ada,
        timestamp: r.timestamp,
      })),
    };
  });

  /** GET /api/prices/:asset — price history for a single token. */
  app.get("/api/prices/:asset", async (req) => {
    const { asset } = req.params as { asset: string };
    const query = req.query as { hours?: string };
    const hours = Math.min(parseInt(query.hours || "24", 10), 720);

    const rows = await sql`
      SELECT asset, price_ada, price_usd, volume_ada,
             EXTRACT(EPOCH FROM timestamp)::int AS timestamp
      FROM prices
      WHERE asset = ${asset}
        AND timestamp > NOW() - INTERVAL '1 hour' * ${hours}
      ORDER BY timestamp ASC
    `;

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        priceAda: r.price_ada,
        priceUsd: r.price_usd,
        volumeAda: r.volume_ada,
        timestamp: r.timestamp,
      })),
    };
  });
}
