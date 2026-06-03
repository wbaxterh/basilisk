/**
 * @basilisk/ingestion
 * Chain follower — connects to a Cardano data provider, ingests blocks
 * and transactions into Postgres.
 *
 * Owns: EPIC-0 (US-0.1, US-0.2)
 */

import { createLogger, loadConfig } from "@basilisk/shared";
import { BlockfrostProvider } from "@basilisk/chain-data";
import { createDb } from "./db.js";
import { startFollower } from "./follower.js";

const log = createLogger("ingestion");

async function main(): Promise<void> {
  log.info("initializing ingestion service");

  const config = loadConfig(
    "blockfrostProjectId",
    "blockfrostNetwork",
    "databaseUrl",
    "logLevel",
  );

  // Set up the chain data provider (Blockfrost for now, Demeter/Ogmios later).
  const provider = new BlockfrostProvider({
    projectId: config.blockfrostProjectId,
    network: config.blockfrostNetwork,
  });

  // Verify provider is reachable.
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

  // Connect to the database.
  const sql = createDb(config.databaseUrl);
  log.info("database connected");

  // Start the block follower.
  const follower = startFollower(provider, sql, log);

  // Graceful shutdown.
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
