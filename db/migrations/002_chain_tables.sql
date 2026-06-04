-- 002: Core chain tables — blocks and transactions.
-- These are filled by the ingestion service (EPIC-0: US-0.1, US-0.2).

CREATE TABLE IF NOT EXISTS blocks (
  hash        TEXT        PRIMARY KEY,
  slot        BIGINT      NOT NULL UNIQUE,
  height      BIGINT      NOT NULL UNIQUE,
  epoch       INT         NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL,
  tx_count    INT         NOT NULL DEFAULT 0,
  fees        NUMERIC     NOT NULL DEFAULT 0,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blocks_height ON blocks (height);
CREATE INDEX idx_blocks_timestamp ON blocks (timestamp);

CREATE TABLE IF NOT EXISTS transactions (
  hash         TEXT        PRIMARY KEY,
  block_hash   TEXT        NOT NULL REFERENCES blocks(hash),
  block_height BIGINT      NOT NULL,
  slot         BIGINT      NOT NULL,
  block_index  INT         NOT NULL,
  timestamp    TIMESTAMPTZ NOT NULL,
  fees         NUMERIC     NOT NULL DEFAULT 0,
  metadata     JSONB,
  ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_block_hash ON transactions (block_hash);
CREATE INDEX idx_tx_timestamp ON transactions (timestamp);
CREATE INDEX idx_tx_slot ON transactions (slot);
