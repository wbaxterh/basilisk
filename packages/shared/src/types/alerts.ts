/**
 * Alert types — rule definitions and history entries.
 * Used by services/alerts and the API gateway.
 */

/** Supported alert rule types. */
export type AlertRuleType =
  | "price_above"
  | "price_below"
  | "pct_change"
  | "whale_move"
  | "balance_change";

/** Condition payload stored in alert_rules.condition JSONB. */
export interface AlertCondition {
  /** Price threshold (for price_above / price_below). */
  threshold?: string;
  /** Percentage threshold (for pct_change). */
  pctThreshold?: number;
  /** Time window for pct_change evaluation (e.g. "24h"). */
  window?: string;
}

/** An alert rule as stored in the database. */
export interface AlertRule {
  id: string;
  userId: string;
  type: AlertRuleType;
  asset: string | null;
  walletId: string | null;
  condition: AlertCondition;
  channels: string[];
  enabled: boolean;
  cooldownS: number;
  lastFired: number | null;
  createdAt: number;
  updatedAt: number;
}

/** An alert history entry — records a fired alert. */
export interface AlertHistoryEntry {
  id: string;
  ruleId: string;
  firedAt: number;
  payload: Record<string, unknown>;
  delivered: boolean;
}
