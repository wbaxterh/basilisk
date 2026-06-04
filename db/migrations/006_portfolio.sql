-- 006: Portfolio tables — wallets, holdings, snapshots (EPIC-2).

CREATE TABLE IF NOT EXISTS wallets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_address TEXT        NOT NULL,
  label         TEXT,
  user_id       UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, stake_address)
);

CREATE INDEX idx_wallets_stake ON wallets (stake_address);
CREATE INDEX idx_wallets_user ON wallets (user_id);

-- Current holdings (materialized state, updated on each new block).
CREATE TABLE IF NOT EXISTS holdings (
  wallet_id   UUID    NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  asset       TEXT    NOT NULL,  -- 'lovelace' or policyId||assetName
  quantity    NUMERIC NOT NULL DEFAULT 0,
  value_ada   NUMERIC NOT NULL DEFAULT 0,
  value_usd   NUMERIC,
  avg_cost_ada NUMERIC,
  PRIMARY KEY (wallet_id, asset)
);

-- Historical portfolio snapshots for value-over-time chart.
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  wallet_id       UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  timestamp       TIMESTAMPTZ NOT NULL,
  total_value_ada NUMERIC     NOT NULL DEFAULT 0,
  total_value_usd NUMERIC,
  holdings_json   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (wallet_id, timestamp)
);

SELECT create_hypertable(
  'portfolio_snapshots', 'timestamp',
  chunk_time_interval => INTERVAL '30 days',
  if_not_exists => TRUE
);
