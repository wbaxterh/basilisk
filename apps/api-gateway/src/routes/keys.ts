/**
 * API key management endpoints.
 */

import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

function generateApiKey(): string {
  const random = randomBytes(24).toString("hex");
  return `bsk_live_${random}`;
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function keyRoutes(
  app: FastifyInstance,
  sql: Sql,
): Promise<void> {
  /** POST /api/keys — create a new API key. Returns the raw key once. */
  app.post("/api/keys", async (req, reply) => {
    const body = req.body as {
      userId?: string;
      tier?: string;
    };

    if (!body.userId) {
      reply.status(400);
      return { error: { code: "MISSING_FIELD", message: "userId is required" } };
    }

    // Verify user exists.
    const users = await sql`
      SELECT id FROM users WHERE id = ${body.userId}::uuid
    `;
    if (users.length === 0) {
      reply.status(404);
      return { error: { code: "NOT_FOUND", message: "User not found" } };
    }

    const tier = body.tier ?? "free";
    const rateLimit = tier === "enterprise" ? 10000 : tier === "pro" ? 1000 : 100;

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const rows = await sql`
      INSERT INTO api_keys (user_id, key_hash, key_prefix, tier, rate_limit)
      VALUES (${body.userId}::uuid, ${keyHash}, ${keyPrefix}, ${tier}, ${rateLimit})
      RETURNING
        id,
        key_prefix,
        tier,
        rate_limit,
        enabled,
        EXTRACT(EPOCH FROM created_at)::int AS created_at
    `;

    const r = rows[0]!;
    reply.status(201);
    return {
      data: {
        id: r.id,
        key: rawKey,
        keyPrefix: r.key_prefix,
        tier: r.tier,
        rateLimit: r.rate_limit,
        enabled: r.enabled,
        createdAt: r.created_at,
      },
    };
  });
}
