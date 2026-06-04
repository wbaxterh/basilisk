/**
 * @basilisk/ingestion
 * Chain follower — ingests blocks and transactions into Postgres.
 *
 * Supports two modes:
 * - `ogmios` — WebSocket chain-sync via Ogmios (real-time, preferred)
 * - `polling` — REST polling via ChainDataProvider (fallback)
 *
 * Set CHAIN_SYNC_MODE=ogmios|polling (default: polling)
 *
 * Owns: EPIC-0 (US-0.1, US-0.2)
 */

import { createLogger, loadConfig } from "@basilisk/shared";
import { BlockfrostProvider } from "@basilisk/chain-data";
import { createDb } from "./db.js";
import { startFollower } from "./follower.js";
import { startChainSync } from "./chain-sync.js";

const log = createLogger("ingestion");

async function main(): Promise<void> {
  log.info("initializing ingestion service");

  const syncMode = process.env["CHAIN_SYNC_MODE"] || "polling";

  if (syncMode === "ogmios") {
    await startOgmiosMode();
  } else {
    await startPollingMode();
  }
}

async function startOgmiosMode(): Promise<void> {
  log.info("starting in Ogmios chain-sync mode");

  const config = loadConfig("databaseUrl", "logLevel");
  const ogmiosHost = process.env["OGMIOS_HOST"] || "localhost";
  const ogmiosPort = parseInt(process.env["OGMIOS_PORT"] || "1337", 10);
  const ogmiosTls = process.env["OGMIOS_TLS"] === "true";

  const sql = createDb(config.databaseUrl);
  log.info("database connected");

  const sync = await startChainSync(sql, log, {
    ogmiosHost,
    ogmiosPort,
    ogmiosTls,
  });

  const shutdown = async () => {
    log.info("shutting down...");
    await sync.stop();
    await sql.end();
    log.info("goodbye");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function startPollingMode(): Promise<void> {
  log.info("starting in polling mode (set CHAIN_SYNC_MODE=ogmios for streaming)");

  const config = loadConfig(
    "blockfrostProjectId",
    "blockfrostNetwork",
    "databaseUrl",
    "logLevel",
  );

  const provider = new BlockfrostProvider({
    projectId: config.blockfrostProjectId,
    network: config.blockfrostNetwork,
  });

  const healthy = await provider.isHealthy();
  if (!healthy) {
    log.error("chain data provider is not healthy, exiting");
    process.exit(1);
  }

  const tip = await provider.getTip();
  log.info("provider connected", {
    provider: provider.name,
    network: config.blockfrostNetwork,
    tipSlot: tip.slot,
    tipHeight: tip.height,
  });

  const sql = createDb(config.databaseUrl);
  log.info("database connected");

  const follower = startFollower(provider, sql, log);

  const shutdown = async () => {
    log.info("shutting down...");
    follower.stop();
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
