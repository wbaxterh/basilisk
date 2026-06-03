-- 008: Users and API keys (EPIC-1, EPIC-8).

CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        UNIQUE,
  password_hash  TEXT,                  -- null for wallet-only auth
  stake_address  TEXT,                  -- primary linked wallet
  display_name   TEXT,
  auth_provider  TEXT        NOT NULL DEFAULT 'email',  -- 'email','google','wallet'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_stake ON users (stake_address) WHERE stake_address IS NOT NULL;

-- API keys for the public data API (EPIC-8).
CREATE TABLE IF NOT EXISTS api_keys (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash   TEXT        NOT NULL UNIQUE,  -- SHA-256 of the raw key
  key_prefix TEXT        NOT NULL,         -- first 8 chars for display (e.g. "bsk_live_abc...")
  tier       TEXT        NOT NULL DEFAULT 'free',  -- 'free','pro','enterprise'
  rate_limit INT         NOT NULL DEFAULT 100,     -- requests per minute
  enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys (user_id);
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE enabled = TRUE;

-- Ingestion sync cursor — tracks where the chain follower left off.
CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the initial sync cursor.
INSERT INTO sync_state (key, value) VALUES ('last_slot', '0')
ON CONFLICT (key) DO NOTHING;
