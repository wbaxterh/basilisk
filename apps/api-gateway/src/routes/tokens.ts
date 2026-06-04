/**
 * Token metadata and listing endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function tokenRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/tokens — list tokens with metadata. */
  app.get("/api/tokens", async (req) => {
    const query = req.query as { page?: string; perPage?: string; search?: string };
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const perPage = Math.min(parseInt(query.perPage || "50", 10), 200);
    const offset = (page - 1) * perPage;

    let rows;
    if (query.search) {
      const pattern = `%${query.search}%`;
      rows = await sql`
        SELECT asset, policy_id, asset_name, ticker, name, decimals,
               logo_url, description, website,
               EXTRACT(EPOCH FROM updated_at)::int AS updated_at
        FROM token_metadata
        WHERE ticker ILIKE ${pattern} OR name ILIKE ${pattern}
        ORDER BY ticker ASC
        LIMIT ${perPage} OFFSET ${offset}
      `;
    } else {
      rows = await sql`
        SELECT asset, policy_id, asset_name, ticker, name, decimals,
               logo_url, description, website,
               EXTRACT(EPOCH FROM updated_at)::int AS updated_at
        FROM token_metadata
        ORDER BY ticker ASC
        LIMIT ${perPage} OFFSET ${offset}
      `;
    }

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        policyId: r.policy_id,
        assetName: r.asset_name,
        ticker: r.ticker,
        name: r.name,
        decimals: r.decimals,
        logoUrl: r.logo_url,
        description: r.description,
        website: r.website,
        updatedAt: r.updated_at,
      })),
      meta: { page, perPage },
    };
  });

  /** GET /api/tokens/:asset — single token metadata + current price. */
  app.get("/api/tokens/:asset", async (req) => {
    const { asset } = req.params as { asset: string };

    const [metaRows, priceRows] = await Promise.all([
      sql`
        SELECT asset, policy_id, asset_name, ticker, name, decimals,
               logo_url, description, website,
               EXTRACT(EPOCH FROM updated_at)::int AS updated_at
        FROM token_metadata
        WHERE asset = ${asset}
        LIMIT 1
      `,
      sql`
        SELECT price_ada, price_usd, volume_ada,
               EXTRACT(EPOCH FROM timestamp)::int AS timestamp
        FROM prices
        WHERE asset = ${asset}
        ORDER BY timestamp DESC
        LIMIT 1
      `,
    ]);

    if (metaRows.length === 0) {
      return { error: { code: "NOT_FOUND", message: "Token not found" } };
    }

    const meta = metaRows[0]!;
    const price = priceRows[0];

    return {
      data: {
        asset: meta.asset,
        policyId: meta.policy_id,
        assetName: meta.asset_name,
        ticker: meta.ticker,
        name: meta.name,
        decimals: meta.decimals,
        logoUrl: meta.logo_url,
        description: meta.description,
        website: meta.website,
        updatedAt: meta.updated_at,
        price: price
          ? {
              priceAda: price.price_ada,
              priceUsd: price.price_usd,
              volumeAda: price.volume_ada,
              timestamp: price.timestamp,
            }
          : null,
      },
    };
  });
}
