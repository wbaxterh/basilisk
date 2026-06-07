/**
 * Screener endpoints — top tokens by volume, gainers, and losers.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function screenerRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/screener/top — top tokens ranked by 24h volume. */
  app.get("/api/screener/top", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    const rows = await sql`
      WITH volume_24h AS (
        SELECT
          CASE WHEN asset_in = 'lovelace' THEN asset_out ELSE asset_in END AS asset,
          SUM(CASE WHEN asset_in = 'lovelace' THEN amount_in ELSE amount_out END) AS volume_ada
        FROM dex_swaps
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND (asset_in = 'lovelace' OR asset_out = 'lovelace')
        GROUP BY 1
      ),
      latest_prices AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada, price_usd
        FROM prices
        ORDER BY asset, timestamp DESC
      ),
      prices_24h_ago AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada AS price_ada_24h
        FROM prices
        WHERE timestamp <= NOW() - INTERVAL '24 hours'
        ORDER BY asset, timestamp DESC
      )
      SELECT
        v.asset,
        COALESCE(tm.ticker, tm.name) AS ticker,
        lp.price_ada,
        lp.price_usd,
        v.volume_ada,
        CASE WHEN p24.price_ada_24h::numeric > 0
          THEN ((lp.price_ada::numeric - p24.price_ada_24h::numeric)
                / p24.price_ada_24h::numeric * 100)
          ELSE NULL
        END AS change_24h
      FROM volume_24h v
      INNER JOIN latest_prices lp ON lp.asset = v.asset
      LEFT JOIN prices_24h_ago p24 ON p24.asset = v.asset
      LEFT JOIN token_metadata tm ON tm.asset = v.asset
      ORDER BY v.volume_ada DESC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r, i) => ({
        rank: i + 1,
        asset: r.asset,
        ticker: r.ticker,
        priceAda: r.price_ada,
        priceUsd: r.price_usd,
        volumeAda: r.volume_ada,
        change24h: r.change_24h != null ? parseFloat(r.change_24h).toFixed(2) : null,
      })),
    };
  });

  /** GET /api/screener/gainers — tokens with highest 24h price increase. */
  app.get("/api/screener/gainers", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    const rows = await sql`
      WITH latest_prices AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada, price_usd
        FROM prices
        ORDER BY asset, timestamp DESC
      ),
      prices_24h_ago AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada AS price_ada_24h
        FROM prices
        WHERE timestamp <= NOW() - INTERVAL '24 hours'
        ORDER BY asset, timestamp DESC
      ),
      volume_24h AS (
        SELECT
          CASE WHEN asset_in = 'lovelace' THEN asset_out ELSE asset_in END AS asset,
          SUM(CASE WHEN asset_in = 'lovelace' THEN amount_in ELSE amount_out END) AS volume_ada
        FROM dex_swaps
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND (asset_in = 'lovelace' OR asset_out = 'lovelace')
        GROUP BY 1
      )
      SELECT
        lp.asset,
        COALESCE(tm.ticker, tm.name) AS ticker,
        lp.price_ada,
        lp.price_usd,
        COALESCE(v.volume_ada, 0) AS volume_ada,
        ((lp.price_ada::numeric - p24.price_ada_24h::numeric)
          / p24.price_ada_24h::numeric * 100) AS change_24h
      FROM latest_prices lp
      INNER JOIN prices_24h_ago p24 ON p24.asset = lp.asset
      LEFT JOIN volume_24h v ON v.asset = lp.asset
      LEFT JOIN token_metadata tm ON tm.asset = lp.asset
      WHERE p24.price_ada_24h::numeric > 0
        AND lp.price_ada::numeric > p24.price_ada_24h::numeric
      ORDER BY change_24h DESC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r, i) => ({
        rank: i + 1,
        asset: r.asset,
        ticker: r.ticker,
        priceAda: r.price_ada,
        priceUsd: r.price_usd,
        volumeAda: r.volume_ada,
        change24h: parseFloat(r.change_24h).toFixed(2),
      })),
    };
  });

  /** GET /api/screener/losers — tokens with biggest 24h price drop. */
  app.get("/api/screener/losers", async (req) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    const rows = await sql`
      WITH latest_prices AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada, price_usd
        FROM prices
        ORDER BY asset, timestamp DESC
      ),
      prices_24h_ago AS (
        SELECT DISTINCT ON (asset)
          asset, price_ada AS price_ada_24h
        FROM prices
        WHERE timestamp <= NOW() - INTERVAL '24 hours'
        ORDER BY asset, timestamp DESC
      ),
      volume_24h AS (
        SELECT
          CASE WHEN asset_in = 'lovelace' THEN asset_out ELSE asset_in END AS asset,
          SUM(CASE WHEN asset_in = 'lovelace' THEN amount_in ELSE amount_out END) AS volume_ada
        FROM dex_swaps
        WHERE timestamp > NOW() - INTERVAL '24 hours'
          AND (asset_in = 'lovelace' OR asset_out = 'lovelace')
        GROUP BY 1
      )
      SELECT
        lp.asset,
        COALESCE(tm.ticker, tm.name) AS ticker,
        lp.price_ada,
        lp.price_usd,
        COALESCE(v.volume_ada, 0) AS volume_ada,
        ((lp.price_ada::numeric - p24.price_ada_24h::numeric)
          / p24.price_ada_24h::numeric * 100) AS change_24h
      FROM latest_prices lp
      INNER JOIN prices_24h_ago p24 ON p24.asset = lp.asset
      LEFT JOIN volume_24h v ON v.asset = lp.asset
      LEFT JOIN token_metadata tm ON tm.asset = lp.asset
      WHERE p24.price_ada_24h::numeric > 0
        AND lp.price_ada::numeric < p24.price_ada_24h::numeric
      ORDER BY change_24h ASC
      LIMIT ${limit}
    `;

    return {
      data: rows.map((r, i) => ({
        rank: i + 1,
        asset: r.asset,
        ticker: r.ticker,
        priceAda: r.price_ada,
        priceUsd: r.price_usd,
        volumeAda: r.volume_ada,
        change24h: parseFloat(r.change_24h).toFixed(2),
      })),
    };
  });
}
