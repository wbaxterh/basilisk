/**
 * Alert rule evaluator — checks rules against current market data.
 */

import type { AlertRule } from "@basilisk/shared";
import type { Logger } from "@basilisk/shared";
import type { Sql } from "./db.js";
import {
  getLatestPrice,
  getPrice24hAgo,
  insertAlertHistory,
  updateLastFired,
} from "./db.js";

/** Result of evaluating a single rule. */
export interface EvalResult {
  fired: boolean;
  payload?: Record<string, unknown>;
}

/** Check whether the cooldown period has elapsed since last_fired. */
function isCooldownElapsed(rule: AlertRule): boolean {
  if (rule.lastFired === null) return true;
  const nowS = Math.floor(Date.now() / 1000);
  return nowS - rule.lastFired >= rule.cooldownS;
}

/** Evaluate a price_above rule. */
async function evalPriceAbove(
  sql: Sql,
  rule: AlertRule,
): Promise<EvalResult> {
  if (!rule.asset) return { fired: false };
  const threshold = rule.condition.threshold;
  if (!threshold) return { fired: false };

  const price = await getLatestPrice(sql, rule.asset);
  if (!price) return { fired: false };

  const currentPrice = parseFloat(price.priceAda);
  const thresholdValue = parseFloat(threshold);

  if (currentPrice >= thresholdValue) {
    return {
      fired: true,
      payload: {
        type: "price_above",
        asset: rule.asset,
        currentPrice: price.priceAda,
        threshold,
        timestamp: price.timestamp,
      },
    };
  }

  return { fired: false };
}

/** Evaluate a price_below rule. */
async function evalPriceBelow(
  sql: Sql,
  rule: AlertRule,
): Promise<EvalResult> {
  if (!rule.asset) return { fired: false };
  const threshold = rule.condition.threshold;
  if (!threshold) return { fired: false };

  const price = await getLatestPrice(sql, rule.asset);
  if (!price) return { fired: false };

  const currentPrice = parseFloat(price.priceAda);
  const thresholdValue = parseFloat(threshold);

  if (currentPrice <= thresholdValue) {
    return {
      fired: true,
      payload: {
        type: "price_below",
        asset: rule.asset,
        currentPrice: price.priceAda,
        threshold,
        timestamp: price.timestamp,
      },
    };
  }

  return { fired: false };
}

/** Evaluate a pct_change rule (24h % move). */
async function evalPctChange(
  sql: Sql,
  rule: AlertRule,
): Promise<EvalResult> {
  if (!rule.asset) return { fired: false };
  const pctThreshold = rule.condition.pctThreshold;
  if (pctThreshold === undefined) return { fired: false };

  const current = await getLatestPrice(sql, rule.asset);
  if (!current) return { fired: false };

  const past = await getPrice24hAgo(sql, rule.asset);
  if (!past) return { fired: false };

  const currentPrice = parseFloat(current.priceAda);
  const pastPrice = parseFloat(past.priceAda);

  if (pastPrice === 0) return { fired: false };

  const pctChange = ((currentPrice - pastPrice) / pastPrice) * 100;

  // Fire if the absolute % change exceeds the threshold.
  if (Math.abs(pctChange) >= Math.abs(pctThreshold)) {
    return {
      fired: true,
      payload: {
        type: "pct_change",
        asset: rule.asset,
        currentPrice: current.priceAda,
        pastPrice: past.priceAda,
        pctChange: pctChange.toFixed(2),
        pctThreshold,
        timestamp: current.timestamp,
      },
    };
  }

  return { fired: false };
}

/** Evaluate a single alert rule against current data. */
export async function evaluateRule(
  sql: Sql,
  rule: AlertRule,
  log: Logger,
): Promise<void> {
  // Skip if still in cooldown.
  if (!isCooldownElapsed(rule)) return;

  let result: EvalResult;

  switch (rule.type) {
    case "price_above":
      result = await evalPriceAbove(sql, rule);
      break;
    case "price_below":
      result = await evalPriceBelow(sql, rule);
      break;
    case "pct_change":
      result = await evalPctChange(sql, rule);
      break;
    default:
      // whale_move and balance_change are not yet implemented.
      return;
  }

  if (result.fired && result.payload) {
    await insertAlertHistory(sql, rule.id, result.payload);
    await updateLastFired(sql, rule.id);

    log.info("alert fired", {
      ruleId: rule.id,
      type: rule.type,
      asset: rule.asset,
      channels: rule.channels,
    });
  }
}
