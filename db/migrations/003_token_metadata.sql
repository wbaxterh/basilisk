-- 003: Token metadata registry (EPIC-0: US-0.6).
-- Stores display info for Cardano native assets.

CREATE TABLE IF NOT EXISTS token_metadata (
  asset       TEXT PRIMARY KEY,  -- policyId || assetName (hex)
  policy_id   TEXT NOT NULL,
  asset_name  TEXT NOT NULL,     -- hex-encoded
  ticker      TEXT,
  name        TEXT,
  decimals    INT  NOT NULL DEFAULT 0,
  logo_url    TEXT,
  description TEXT,
  website     TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_ticker ON token_metadata (ticker);
CREATE INDEX idx_token_policy ON token_metadata (policy_id);
