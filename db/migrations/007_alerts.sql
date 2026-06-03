-- 007: Alert rules and history (EPIC-7).

CREATE TABLE IF NOT EXISTS alert_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  type        TEXT        NOT NULL,  -- 'price_above','price_below','pct_change','whale_move','balance_change'
  asset       TEXT,                  -- null for wallet-level alerts
  wallet_id   UUID        REFERENCES wallets(id) ON DELETE SET NULL,
  condition   JSONB       NOT NULL,  -- { "threshold": 1.5, "window": "1h", ... }
  channels    TEXT[]      NOT NULL DEFAULT '{"email"}',  -- 'email','push','telegram','discord'
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  cooldown_s  INT         NOT NULL DEFAULT 3600,
  last_fired  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alert_rules (user_id);
CREATE INDEX idx_alerts_asset ON alert_rules (asset) WHERE asset IS NOT NULL;
CREATE INDEX idx_alerts_enabled ON alert_rules (enabled) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS alert_history (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id    UUID        NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  fired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload    JSONB       NOT NULL,  -- snapshot of what triggered
  delivered  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_alert_hist_rule ON alert_history (rule_id, fired_at DESC);
