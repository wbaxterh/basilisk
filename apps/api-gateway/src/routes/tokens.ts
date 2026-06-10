/**
 * Token metadata and listing endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";
import type { ChainDataProvider } from "@basilisk/chain-data";

export async function tokenRoutes(app: FastifyInstance, sql: Sql, provider: ChainDataProvider): Promise<void> {
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

  /** GET /api/tokens/:asset — single token metadata + current price + market stats. */
  app.get("/api/tokens/:asset", async (req) => {
    const { asset } = req.params as { asset: string };

    const [metaRows, priceRows, price24hAgoRows, volume24hRows, holdersRows] = await Promise.all([
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
      sql`
        SELECT price_ada
        FROM prices
        WHERE asset = ${asset}
          AND timestamp <= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      sql`
        SELECT COALESCE(SUM(volume_ada), 0) AS total_volume
        FROM prices
        WHERE asset = ${asset}
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `,
      sql`
        SELECT COUNT(DISTINCT sender_address) AS holder_count
        FROM dex_swaps
        WHERE (asset_in = ${asset} OR asset_out = ${asset})
          AND sender_address IS NOT NULL
      `,
    ]);

    if (metaRows.length === 0) {
      return { error: { code: "NOT_FOUND", message: "Token not found" } };
    }

    const meta = metaRows[0]!;
    const price = priceRows[0];
    const price24hAgo = price24hAgoRows[0];

    let changePercent24h: number | null = null;
    if (price && price24hAgo && parseFloat(price24hAgo.price_ada) > 0) {
      const current = parseFloat(price.price_ada);
      const old = parseFloat(price24hAgo.price_ada);
      changePercent24h = ((current - old) / old) * 100;
    }

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
        changePercent24h,
        volume24h: volume24hRows[0]?.total_volume ?? "0",
        holders: parseInt(holdersRows[0]?.holder_count ?? "0", 10),
        totalSupply: null,
      },
    };
  });

  /** GET /api/tokens/:asset/holders — top holders and concentration metrics. */
  app.get("/api/tokens/:asset/holders", async (req, reply) => {
    const { asset } = req.params as { asset: string };

    try {
      // Fetch top holders from Blockfrost (sorted by quantity desc).
      const holders = await provider.getAssetAddresses(asset, { count: 20, order: "desc" });

      // Calculate total supply from all holder quantities.
      const totalSupply = holders.reduce(
        (sum, h) => sum + BigInt(h.quantity),
        0n,
      );

      const data = holders.map((h, i) => ({
        rank: i + 1,
        address: h.address,
        quantity: h.quantity,
        percentage:
          totalSupply > 0n
            ? Number((BigInt(h.quantity) * 10000n) / totalSupply) / 100
            : 0,
      }));

      // Concentration metrics.
      const top10Supply = holders
        .slice(0, 10)
        .reduce((sum, h) => sum + BigInt(h.quantity), 0n);

      return {
        data: {
          holders: data,
          totalSupply: totalSupply.toString(),
          concentration: {
            top10Percentage:
              totalSupply > 0n
                ? Number((top10Supply * 10000n) / totalSupply) / 100
                : 0,
            top20Percentage:
              totalSupply > 0n
                ? Number(
                    (holders.reduce((s, h) => s + BigInt(h.quantity), 0n) *
                      10000n) /
                      totalSupply,
                  ) / 100
                : 0,
            holderCount: holders.length,
          },
        },
      };
    } catch (err) {
      reply.status(502);
      return {
        error: {
          code: "PROVIDER_ERROR",
          message:
            err instanceof Error ? err.message : "Failed to fetch holder data",
        },
      };
    }
  });
}
