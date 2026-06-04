/**
 * Wallet / portfolio endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function walletRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/wallets/:stakeAddress/holdings — current holdings for a wallet. */
  app.get("/api/wallets/:stakeAddress/holdings", async (req) => {
    const { stakeAddress } = req.params as { stakeAddress: string };

    const walletRows = await sql`
      SELECT id FROM wallets WHERE stake_address = ${stakeAddress} LIMIT 1
    `;

    if (walletRows.length === 0) {
      return { data: [], meta: { stakeAddress, tracked: false } };
    }

    const walletId = walletRows[0]!.id;

    const rows = await sql`
      SELECT asset, quantity, value_ada, value_usd, avg_cost_ada
      FROM holdings
      WHERE wallet_id = ${walletId}
      ORDER BY value_ada DESC NULLS LAST
    `;

    return {
      data: rows.map((r) => ({
        asset: r.asset,
        quantity: r.quantity,
        valueAda: r.value_ada,
        valueUsd: r.value_usd,
        avgCostAda: r.avg_cost_ada,
      })),
      meta: { stakeAddress, tracked: true },
    };
  });

  /** POST /api/wallets — track a new wallet. */
  app.post("/api/wallets", async (req) => {
    const body = req.body as { stakeAddress: string; label?: string };

    if (!body.stakeAddress) {
      return { error: { code: "MISSING_FIELD", message: "stakeAddress is required" } };
    }

    const rows = await sql`
      INSERT INTO wallets (stake_address, label)
      VALUES (${body.stakeAddress}, ${body.label ?? null})
      ON CONFLICT (user_id, stake_address) DO NOTHING
      RETURNING id, stake_address, label, EXTRACT(EPOCH FROM created_at)::int AS created_at
    `;

    if (rows.length === 0) {
      // Already exists.
      const existing = await sql`
        SELECT id, stake_address, label, EXTRACT(EPOCH FROM created_at)::int AS created_at
        FROM wallets WHERE stake_address = ${body.stakeAddress} LIMIT 1
      `;
      return { data: existing[0] };
    }

    return { data: rows[0] };
  });
}
