/**
 * Database layer for the alerts service.
 */

import postgres from "postgres";
import type { AlertRule, AlertCondition } from "@basilisk/shared";

export type Sql = postgres.Sql;

export function createDb(connectionString: string): Sql {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/** Fetch all enabled alert rules. */
export async function getEnabledRules(sql: Sql): Promise<AlertRule[]> {
  const rows = await sql`
    SELECT id, user_id, type, asset, wallet_id, condition, channels, enabled,
           cooldown_s,
           EXTRACT(EPOCH FROM last_fired)::int AS last_fired,
           EXTRACT(EPOCH FROM created_at)::int AS created_at,
           EXTRACT(EPOCH FROM updated_at)::int AS updated_at
    FROM alert_rules
    WHERE enabled = TRUE
  `;

  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as AlertRule["type"],
    asset: (r.asset as string) ?? null,
    walletId: (r.wallet_id as string) ?? null,
    condition: r.condition as AlertCondition,
    channels: r.channels as string[],
    enabled: r.enabled as boolean,
    cooldownS: r.cooldown_s as number,
    lastFired: (r.last_fired as number) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }));
}

/** Get the latest price for an asset. */
export async function getLatestPrice(
  sql: Sql,
  asset: string,
): Promise<{ priceAda: string; timestamp: number } | null> {
  const rows = await sql`
    SELECT price_ada,
           EXTRACT(EPOCH FROM timestamp)::int AS timestamp
    FROM prices
    WHERE asset = ${asset}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return {
    priceAda: rows[0]!.price_ada as string,
    timestamp: rows[0]!.timestamp as number,
  };
}

/** Get the price for an asset from ~24h ago (for pct_change). */
export async function getPrice24hAgo(
  sql: Sql,
  asset: string,
): Promise<{ priceAda: string; timestamp: number } | null> {
  const rows = await sql`
    SELECT price_ada,
           EXTRACT(EPOCH FROM timestamp)::int AS timestamp
    FROM prices
    WHERE asset = ${asset}
      AND timestamp <= NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return {
    priceAda: rows[0]!.price_ada as string,
    timestamp: rows[0]!.timestamp as number,
  };
}

/** Insert an alert history entry. */
export async function insertAlertHistory(
  sql: Sql,
  ruleId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await sql`
    INSERT INTO alert_history (rule_id, payload)
    VALUES (${ruleId}, ${sql.json(payload as unknown as Record<string, never>)})
  `;
}

/** Update last_fired timestamp for a rule. */
export async function updateLastFired(sql: Sql, ruleId: string): Promise<void> {
  await sql`
    UPDATE alert_rules
    SET last_fired = NOW(), updated_at = NOW()
    WHERE id = ${ruleId}
  `;
}
