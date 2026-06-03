-- 005: VWAP price points and OHLCV candles (EPIC-0: US-0.4, US-0.5).
-- Prices are computed by the pricing service from dex_swaps.

-- Spot VWAP prices (one row per asset per computation window).
CREATE TABLE IF NOT EXISTS prices (
  asset      TEXT        NOT NULL,
  price_ada  NUMERIC     NOT NULL,
  price_usd  NUMERIC,
  volume_ada NUMERIC     NOT NULL DEFAULT 0,
  timestamp  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (asset, timestamp)
);

SELECT create_hypertable(
  'prices', 'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_prices_asset ON prices (asset, timestamp DESC);

-- OHLCV candles at multiple intervals.
-- We store all intervals in one table with an `interval` discriminator.
CREATE TABLE IF NOT EXISTS ohlcv (
  asset       TEXT        NOT NULL,
  interval    TEXT        NOT NULL,  -- '1m','5m','15m','1h','4h','1d'
  open_time   TIMESTAMPTZ NOT NULL,
  close_time  TIMESTAMPTZ NOT NULL,
  open        NUMERIC     NOT NULL,
  high        NUMERIC     NOT NULL,
  low         NUMERIC     NOT NULL,
  close       NUMERIC     NOT NULL,
  volume_ada  NUMERIC     NOT NULL DEFAULT 0,
  trade_count INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (asset, interval, open_time)
);

SELECT create_hypertable(
  'ohlcv', 'open_time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_ohlcv_asset_interval ON ohlcv (asset, interval, open_time DESC);
