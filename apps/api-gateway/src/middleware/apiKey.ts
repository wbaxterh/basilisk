/**
 * API key authentication middleware.
 * Checks X-API-Key header, looks up the SHA-256 hash in api_keys,
 * and decorates the request with key metadata for rate limiting.
 */

import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Sql } from "../db.js";

export interface ApiKeyInfo {
  id: string;
  userId: string;
  tier: string;
  rateLimit: number;
  keyPrefix: string;
}

declare module "fastify" {
  interface FastifyRequest {
    apiKey?: ApiKeyInfo;
  }
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function registerApiKeyMiddleware(
  app: FastifyInstance,
  sql: Sql,
): Promise<void> {
  app.decorateRequest("apiKey", undefined);

  app.addHook(
    "onRequest",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const raw = req.headers["x-api-key"];
      if (!raw || typeof raw !== "string") return;

      const keyHash = hashKey(raw);

      const rows = await sql`
        SELECT id, user_id, tier, rate_limit, key_prefix, enabled
        FROM api_keys
        WHERE key_hash = ${keyHash}
      `;

      if (rows.length === 0) {
        reply.status(401);
        reply.send({
          error: { code: "INVALID_KEY", message: "Invalid API key" },
        });
        return;
      }

      const row = rows[0]!;
      if (!row.enabled) {
        reply.status(403);
        reply.send({
          error: { code: "KEY_DISABLED", message: "API key is disabled" },
        });
        return;
      }

      req.apiKey = {
        id: row.id,
        userId: row.user_id,
        tier: row.tier,
        rateLimit: row.rate_limit,
        keyPrefix: row.key_prefix,
      };

      // Update last_used timestamp (fire-and-forget).
      sql`UPDATE api_keys SET last_used = NOW() WHERE id = ${row.id}`.catch(
        () => {},
      );
    },
  );
}
