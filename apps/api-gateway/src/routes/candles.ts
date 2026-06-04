/**
 * OHLCV candle endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function candleRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/candles/:asset — OHLCV candles for a token. */
  app.get("/api/candles/:asset", async (req) => {
    const { asset } = req.params as { asset: string };
    const query = req.query as { interval?: string; hours?: string };
    const interval = query.interval || "1h";
    const hours = Math.min(parseInt(query.hours || "24", 10), 720);

    // Validate interval.
    const validIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
    if (!validIntervals.includes(interval)) {
      return { error: { code: "INVALID_INTERVAL", message: `interval must be one of: ${validIntervals.join(", ")}` } };
    }

    const rows = await sql`
      SELECT asset, interval, open, high, low, close, volume_ada, trade_count,
             EXTRACT(EPOCH FROM open_time)::int AS open_time,
             EXTRACT(EPOCH FROM close_time)::int AS close_time
      FROM ohlcv
      WHERE asset = ${asset}
        AND interval = ${interval}
        AND open_time > NOW() - INTERVAL '1 hour' * ${hours}
      ORDER BY open_time ASC
    `;

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        interval: r.interval,
        openTime: r.open_time,
        closeTime: r.close_time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volumeAda: r.volume_ada,
        tradeCount: r.trade_count,
      })),
    };
  });
}
