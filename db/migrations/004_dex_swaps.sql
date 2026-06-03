-- 004: DEX swap events (EPIC-0: US-0.3, US-0.4).
-- Decoded swap events from all supported DEXs.
-- This is a TimescaleDB hypertable partitioned by timestamp.

CREATE TABLE IF NOT EXISTS dex_swaps (
  tx_hash        TEXT        NOT NULL,
  dex            TEXT        NOT NULL,  -- 'minswap', 'sundaeswap', etc.
  asset_in       TEXT        NOT NULL,
  amount_in      NUMERIC     NOT NULL,
  asset_out      TEXT        NOT NULL,
  amount_out     NUMERIC     NOT NULL,
  sender_address TEXT,
  pool_id        TEXT        NOT NULL,
  slot           BIGINT      NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tx_hash, dex, pool_id)
);

-- Convert to TimescaleDB hypertable (7-day chunks).
SELECT create_hypertable(
  'dex_swaps', 'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_swaps_asset_in ON dex_swaps (asset_in, timestamp DESC);
CREATE INDEX idx_swaps_asset_out ON dex_swaps (asset_out, timestamp DESC);
CREATE INDEX idx_swaps_dex ON dex_swaps (dex, timestamp DESC);
CREATE INDEX idx_swaps_pool ON dex_swaps (pool_id, timestamp DESC);
