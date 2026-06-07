/**
 * Alert rule CRUD endpoints.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";
import type { AlertRuleType } from "@basilisk/shared";

const VALID_TYPES: AlertRuleType[] = [
  "price_above",
  "price_below",
  "pct_change",
  "whale_move",
  "balance_change",
];

export async function alertRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** GET /api/alerts — list alert rules, optionally filtered by user_id. */
  app.get("/api/alerts", async (req) => {
    const query = req.query as { user_id?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || "50", 10), 200);

    let rows;
    if (query.user_id) {
      rows = await sql`
        SELECT id, user_id, type, asset, wallet_id, condition, channels, enabled,
               cooldown_s,
               EXTRACT(EPOCH FROM last_fired)::int AS last_fired,
               EXTRACT(EPOCH FROM created_at)::int AS created_at,
               EXTRACT(EPOCH FROM updated_at)::int AS updated_at
        FROM alert_rules
        WHERE user_id = ${query.user_id}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT id, user_id, type, asset, wallet_id, condition, channels, enabled,
               cooldown_s,
               EXTRACT(EPOCH FROM last_fired)::int AS last_fired,
               EXTRACT(EPOCH FROM created_at)::int AS created_at,
               EXTRACT(EPOCH FROM updated_at)::int AS updated_at
        FROM alert_rules
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        asset: r.asset,
        walletId: r.wallet_id,
        condition: r.condition,
        channels: r.channels,
        enabled: r.enabled,
        cooldownS: r.cooldown_s,
        lastFired: r.last_fired,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    };
  });

  /** POST /api/alerts — create a new alert rule. */
  app.post("/api/alerts", async (req, reply) => {
    const body = req.body as {
      userId?: string;
      type?: string;
      asset?: string;
      walletId?: string;
      condition?: Record<string, unknown>;
      channels?: string[];
      cooldownS?: number;
    };

    if (!body.userId) {
      reply.status(400);
      return { error: { code: "MISSING_FIELD", message: "userId is required" } };
    }

    if (!body.type || !VALID_TYPES.includes(body.type as AlertRuleType)) {
      reply.status(400);
      return {
        error: {
          code: "INVALID_TYPE",
          message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        },
      };
    }

    if (!body.condition || typeof body.condition !== "object") {
      reply.status(400);
      return { error: { code: "MISSING_FIELD", message: "condition is required" } };
    }

    const channels = body.channels ?? ["email"];
    const cooldownS = body.cooldownS ?? 3600;

    const rows = await sql`
      INSERT INTO alert_rules (user_id, type, asset, wallet_id, condition, channels, cooldown_s)
      VALUES (
        ${body.userId}::uuid,
        ${body.type},
        ${body.asset ?? null},
        ${body.walletId ?? null},
        ${sql.json(body.condition as unknown as Record<string, never>)},
        ${sql.array(channels)},
        ${cooldownS}
      )
      RETURNING
        id, user_id, type, asset, wallet_id, condition, channels, enabled,
        cooldown_s,
        EXTRACT(EPOCH FROM last_fired)::int AS last_fired,
        EXTRACT(EPOCH FROM created_at)::int AS created_at,
        EXTRACT(EPOCH FROM updated_at)::int AS updated_at
    `;

    const r = rows[0]!;
    reply.status(201);
    return {
      data: {
        id: r.id,
        userId: r.user_id,
        type: r.type,
        asset: r.asset,
        walletId: r.wallet_id,
        condition: r.condition,
        channels: r.channels,
        enabled: r.enabled,
        cooldownS: r.cooldown_s,
        lastFired: r.last_fired,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    };
  });

  /** DELETE /api/alerts/:id — delete an alert rule. */
  app.delete("/api/alerts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const rows = await sql`
      DELETE FROM alert_rules
      WHERE id = ${id}::uuid
      RETURNING id
    `;

    if (rows.length === 0) {
      reply.status(404);
      return { error: { code: "NOT_FOUND", message: "Alert rule not found" } };
    }

    return { data: { id: rows[0]!.id, deleted: true } };
  });
}
