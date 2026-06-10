-- 009: Waitlist — early access signups for market validation.

CREATE TABLE IF NOT EXISTS waitlist (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE,
  wallet_addr TEXT,
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_waitlist_email ON waitlist (email) WHERE email IS NOT NULL;
CREATE INDEX idx_waitlist_created ON waitlist (created_at);
