/**
 * @basilisk/portfolio
 * Resolves UTxOs to holdings, marks to market, computes P&L.
 * Periodically refreshes holdings for all tracked wallets.
 *
 * Owns: EPIC-2 (US-2.1, US-2.2, US-2.3), EPIC-5 (US-5.1)
 */

import { createLogger, loadConfig } from "@basilisk/shared";
import { BlockfrostProvider } from "@basilisk/chain-data";
import { createDb, getTrackedWallets } from "./db.js";
import { resolveWalletHoldings } from "./resolver.js";

const log = createLogger("portfolio");

/** How often to refresh holdings (ms). */
const REFRESH_INTERVAL_MS = 60_000; // 1 minute

async function main(): Promise<void> {
  log.info("initializing portfolio service");

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

  log.info("provider connected", { provider: provider.name });

  const sql = createDb(config.databaseUrl);
  log.info("database connected");

  let running = true;

  const shutdown = async () => {
    log.info("shutting down...");
    running = false;
    await sql.end();
    log.info("goodbye");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Main loop: refresh holdings for all tracked wallets.
  while (running) {
    try {
      const wallets = await getTrackedWallets(sql);

      if (wallets.length > 0) {
        log.info("refreshing holdings", { walletCount: wallets.length });

        for (const wallet of wallets) {
          if (!running) break;
          await resolveWalletHoldings(provider, sql, wallet.id, wallet.stakeAddress, log);
        }
      } else {
        log.debug("no wallets tracked, sleeping");
      }
    } catch (err) {
      log.error("refresh error, will retry", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (running) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL_MS));
    }
  }
}

main().catch((err) => {
  log.error("fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
