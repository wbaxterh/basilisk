/**
 * Health check endpoint.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function healthRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  app.get("/health", async () => {
    try {
      await sql`SELECT 1`;
      return { status: "ok", service: "api-gateway", db: "connected" };
    } catch {
      return { status: "degraded", service: "api-gateway", db: "disconnected" };
    }
  });
}
