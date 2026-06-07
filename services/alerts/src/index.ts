/**
 * @basilisk/alerts
 * Alert rules engine evaluating the live event stream (price, %move, whale, balance, new LP).
 *
 * Owns: EPIC-7 (US-7.1, US-7.4)
 *
 * This service:
 * 1. Polls enabled alert_rules from the database.
 * 2. Evaluates each rule against current prices / dex_swaps data.
 * 3. When a condition is met (and cooldown has elapsed), fires the alert:
 *    - Inserts into alert_history.
 *    - Updates last_fired on the rule.
 *    - Logs the event.
 */

import { createLogger, loadConfig } from "@basilisk/shared";
import { createDb, getEnabledRules } from "./db.js";
import { evaluateRule } from "./evaluator.js";

const log = createLogger("alerts");

/** How often to evaluate alert rules (ms). */
const POLL_INTERVAL_MS = 15_000;

async function main(): Promise<void> {
  log.info("initializing alerts service");

  const config = loadConfig("databaseUrl", "logLevel");
  const sql = createDb(config.databaseUrl);

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

  while (running) {
    try {
      const rules = await getEnabledRules(sql);

      if (rules.length > 0) {
        log.debug("evaluating rules", { count: rules.length });

        for (const rule of rules) {
          try {
            await evaluateRule(sql, rule, log);
          } catch (err) {
            log.warn("failed to evaluate rule", {
              ruleId: rule.id,
              type: rule.type,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    } catch (err) {
      log.error("evaluation cycle error, will retry", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  log.error("fatal error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
