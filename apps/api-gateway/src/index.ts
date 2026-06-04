/**
 * @basilisk/api-gateway
 * REST API serving Cardano analytics data to the frontend.
 * Built with Fastify for performance and ESM compatibility.
 *
 * Owns: EPIC-1 (US-1.3), EPIC-8 (US-8.1/8.2/8.3)
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createLogger, loadConfig } from "@basilisk/shared";
import { createDb } from "./db.js";
import { healthRoutes } from "./routes/health.js";
import { priceRoutes } from "./routes/prices.js";
import { candleRoutes } from "./routes/candles.js";
import { tokenRoutes } from "./routes/tokens.js";
import { swapRoutes } from "./routes/swaps.js";
import { blockRoutes } from "./routes/blocks.js";
import { walletRoutes } from "./routes/wallets.js";

const log = createLogger("api-gateway");

async function main(): Promise<void> {
  log.info("initializing api-gateway");

  const config = loadConfig("databaseUrl", "portApiGateway", "logLevel");

  const sql = createDb(config.databaseUrl);

  const app = Fastify({
    logger: false, // We use our own logger.
  });

  // CORS — allow the web app to call us.
  await app.register(cors, {
    origin: true, // Allow all origins in dev; lock down in prod.
    methods: ["GET", "POST", "PUT", "DELETE"],
  });

  // Request logging.
  app.addHook("onResponse", (req, reply) => {
    log.info("request", {
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
    });
  });

  // Register routes.
  await healthRoutes(app, sql);
  await priceRoutes(app, sql);
  await candleRoutes(app, sql);
  await tokenRoutes(app, sql);
  await swapRoutes(app, sql);
  await blockRoutes(app, sql);
  await walletRoutes(app, sql);

  // Start.
  const port = config.portApiGateway;
  await app.listen({ port, host: "0.0.0.0" });
  log.info("api-gateway listening", { port });

  // Graceful shutdown.
  const shutdown = async () => {
    log.info("shutting down...");
    await app.close();
    await sql.end();
    log.info("goodbye");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
