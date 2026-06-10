/**
 * Waitlist endpoints — early access signup for market validation.
 */

import type { FastifyInstance } from "fastify";
import type { Sql } from "../db.js";

export async function waitlistRoutes(app: FastifyInstance, sql: Sql): Promise<void> {
  /** POST /api/waitlist — sign up for early access. */
  app.post("/api/waitlist", async (req, reply) => {
    const body = req.body as { email?: string; walletAddr?: string; referrer?: string };

    if (!body.email && !body.walletAddr) {
      reply.status(400);
      return { error: { code: "MISSING_FIELD", message: "email or walletAddr is required" } };
    }

    // Basic email validation.
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      reply.status(400);
      return { error: { code: "INVALID_EMAIL", message: "Invalid email address" } };
    }

    try {
      await sql`
        INSERT INTO waitlist (email, wallet_addr, referrer)
        VALUES (${body.email ?? null}, ${body.walletAddr ?? null}, ${body.referrer ?? null})
        ON CONFLICT (email) DO NOTHING
      `;

      // Get current count for social proof.
      const countRows = await sql`SELECT COUNT(*)::int AS count FROM waitlist`;
      const count = countRows[0]?.count ?? 0;

      reply.status(201);
      return { data: { success: true, position: count } };
    } catch {
      reply.status(500);
      return { error: { code: "SIGNUP_FAILED", message: "Could not process signup" } };
    }
  });

  /** GET /api/waitlist/count — public signup count for social proof. */
  app.get("/api/waitlist/count", async () => {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM waitlist`;
    return { data: { count: rows[0]?.count ?? 0 } };
  });
}
