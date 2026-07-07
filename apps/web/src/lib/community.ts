/**
 * Basilisk community layer — server-side wallet-signature verification and
 * Neon Postgres persistence for daily boosts + token discussion.
 *
 * Boosts here are free and democratic: one boost per stake address per UTC
 * day, verified by a CIP-30 `signData` signature (CIP-8/COSE). No payment,
 * no ranking auction — unlike TapTools' 300-ADA paid Boosts, visibility is
 * earned one wallet signature at a time.
 *
 * NOT for the browser: verification + DB access only. The signing side
 * lives in src/lib/wallet.ts (signCommunityPayload).
 *
 * Graceful no-DB mode: when DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL
 * is unset, reads return empty summaries and writes throw ApiError(503).
 */

import { neon } from "@neondatabase/serverless";
import verifyDataSignature from "@cardano-foundation/cardano-verify-datasignature";
import { bech32 } from "bech32";

import { ApiError } from "@/lib/dex-data";

// ---------------------------------------------------------------------------
// Payload contract (mirrored by the browser signer in src/lib/wallet.ts)
// ---------------------------------------------------------------------------

/** Signed once per UTC day per stake address. `day` must equal today (UTC). */
export interface BoostPayload {
  action: "boost";
  /** Cardano asset unit: policyId + assetNameHex, lowercase hex. */
  unit: string;
  /** UTC day the boost applies to, "YYYY-MM-DD". Must be today. */
  day: string;
}

/** Signed per comment. `ts` must be within ±5 minutes of server time. */
export interface CommentPayload {
  action: "comment";
  unit: string;
  body: string;
  /** ISO timestamp from the client; replay window is ±5 minutes. */
  ts: string;
}

export const UNIT_RE = /^[0-9a-f]{56,120}$/;

const COMMENT_MAX_LEN = 500;
const COMMENT_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const COMMENTS_PER_DAY_LIMIT = 10;

/** Today's UTC calendar day, "YYYY-MM-DD". */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "stake1uy…abcd" style abbreviation for display in comment lists. */
export function shortStake(stakeAddress: string): string {
  if (stakeAddress.length <= 12) return stakeAddress;
  return `${stakeAddress.slice(0, 8)}…${stakeAddress.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Signature verification (CIP-8/COSE via cardano-verify-datasignature)
// ---------------------------------------------------------------------------

export interface SignedRequest {
  /** COSE_Sign1 CBOR hex string from CIP-30 signData. */
  signatureCose: string;
  /** COSE_Key CBOR hex string from CIP-30 signData. */
  keyCose: string;
  /** The exact JSON string that was hex-encoded and signed. */
  payloadJson: string;
  /** 29-byte hex reward address (e1-prefixed mainnet) from getRewardAddresses()[0]. */
  rewardAddressHex: string;
}

const REWARD_ADDR_HEX_RE = /^e1[0-9a-f]{56}$/;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Derive the bech32 stake1 address from a 29-byte hex mainnet reward address. */
export function rewardAddressHexToBech32(rewardAddressHex: string): string {
  const hex = rewardAddressHex.toLowerCase();
  if (!REWARD_ADDR_HEX_RE.test(hex)) {
    throw new ApiError(
      401,
      "Invalid reward address",
      "Expected a 29-byte hex mainnet reward address (e1-prefixed), as returned by CIP-30 getRewardAddresses()."
    );
  }
  return bech32.encode("stake", bech32.toWords(hexToBytes(hex)));
}

/**
 * Verify that `payloadJson` was signed (CIP-30 signData → CIP-8/COSE) by the
 * wallet that owns `rewardAddressHex`. Deterministic and log-free.
 *
 * @returns the bech32 stake address on success
 * @throws ApiError(401) on any verification failure
 */
export function verifyWalletSignature(req: SignedRequest): { stakeAddress: string } {
  const stakeAddress = rewardAddressHexToBech32(req.rewardAddressHex);

  let valid = false;
  try {
    valid = verifyDataSignature(req.signatureCose, req.keyCose, req.payloadJson, stakeAddress);
  } catch {
    valid = false; // malformed CBOR / key — treat as invalid signature
  }

  if (!valid) {
    throw new ApiError(
      401,
      "Signature verification failed",
      "The COSE signature does not match the payload and reward address. Sign the exact payload JSON with the wallet's reward address via CIP-30 signData."
    );
  }

  return { stakeAddress };
}

// ---------------------------------------------------------------------------
// Payload validation (server rules)
// ---------------------------------------------------------------------------

function parseJsonObject(payloadJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    throw new ApiError(400, "Payload is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, "Payload must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function requireUnit(value: unknown): string {
  if (typeof value !== "string" || !UNIT_RE.test(value)) {
    throw new ApiError(
      400,
      "Invalid asset unit",
      "unit must be lowercase hex policyId + assetNameHex (56-120 chars)."
    );
  }
  return value;
}

/** Validate a boost payload: action, unit shape, and day === today UTC. */
export function parseBoostPayload(payloadJson: string): BoostPayload {
  const obj = parseJsonObject(payloadJson);
  if (obj.action !== "boost") {
    throw new ApiError(400, "Payload action must be \"boost\"");
  }
  const unit = requireUnit(obj.unit);
  const today = todayUtc();
  if (typeof obj.day !== "string" || obj.day !== today) {
    throw new ApiError(
      400,
      "Boost day mismatch",
      `Boost payloads must be signed for today (UTC): expected day="${today}".`
    );
  }
  return { action: "boost", unit, day: today };
}

/** Validate a comment payload: action, unit, body 1-500 chars, ts within ±5 min. */
export function parseCommentPayload(payloadJson: string): CommentPayload {
  const obj = parseJsonObject(payloadJson);
  if (obj.action !== "comment") {
    throw new ApiError(400, "Payload action must be \"comment\"");
  }
  const unit = requireUnit(obj.unit);

  if (typeof obj.body !== "string") {
    throw new ApiError(400, "Comment body is required");
  }
  const body = obj.body.trim();
  if (body.length < 1 || body.length > COMMENT_MAX_LEN) {
    throw new ApiError(
      400,
      "Comment body must be 1-500 characters",
      `Got ${body.length} characters after trimming.`
    );
  }

  if (typeof obj.ts !== "string") {
    throw new ApiError(400, "Comment timestamp (ts) is required");
  }
  const tsMs = Date.parse(obj.ts);
  if (Number.isNaN(tsMs)) {
    throw new ApiError(400, "Comment timestamp (ts) must be an ISO date string");
  }
  if (Math.abs(Date.now() - tsMs) > COMMENT_REPLAY_WINDOW_MS) {
    throw new ApiError(
      400,
      "Comment timestamp outside the allowed window",
      "ts must be within 5 minutes of server time — re-sign and retry."
    );
  }

  return { action: "comment", unit, body, ts: obj.ts };
}

// ---------------------------------------------------------------------------
// Database (Neon serverless, lazy schema like /api/waitlist)
// ---------------------------------------------------------------------------

type Sql = ReturnType<typeof neon<false, false>>;

function getConnStr(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL
  );
}

export function hasDatabase(): boolean {
  return Boolean(getConnStr());
}

const NO_DB_ERROR = () =>
  new ApiError(
    503,
    "Community features need the database",
    "Set DATABASE_URL (Neon Postgres) to enable boosts and comments. Reads degrade to empty summaries without it."
  );

let schemaReady = false;
async function ensureSchema(sql: Sql): Promise<void> {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS basilisk_boosts (
      id            BIGSERIAL   PRIMARY KEY,
      unit          TEXT        NOT NULL,
      stake_address TEXT        NOT NULL,
      day           DATE        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (stake_address, day)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_basilisk_boosts_unit_day ON basilisk_boosts (unit, day)`;
  await sql`
    CREATE TABLE IF NOT EXISTS basilisk_comments (
      id            BIGSERIAL   PRIMARY KEY,
      unit          TEXT        NOT NULL,
      stake_address TEXT        NOT NULL,
      body          TEXT        NOT NULL,
      signed_ts     TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE basilisk_comments ADD COLUMN IF NOT EXISTS signed_ts TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS idx_basilisk_comments_unit_created ON basilisk_comments (unit, created_at DESC)`;
  // Replay guard: the signed payload's ts is signature-bound, so a replayed
  // request carries the identical ts — one row per (stake, signed ts).
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_basilisk_comments_stake_ts ON basilisk_comments (stake_address, signed_ts)`;
  schemaReady = true;
}

async function getSql(): Promise<Sql | null> {
  const connStr = getConnStr();
  if (!connStr) return null;
  const sql = neon(connStr);
  await ensureSchema(sql);
  return sql;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23505"
  );
}

// ---------------------------------------------------------------------------
// Boosts
// ---------------------------------------------------------------------------

export interface BoostSummary {
  unit: string;
  boosts24h: number;
  boosts7d: number;
  boostsToday: number;
}

/**
 * Record one boost for today. One boost per stake address per UTC day,
 * enforced by the UNIQUE (stake_address, day) constraint.
 *
 * @throws ApiError(409) if this stake already boosted today
 * @throws ApiError(503) when no database is configured
 */
export async function addBoost(unit: string, stakeAddress: string, day: string): Promise<void> {
  const sql = await getSql();
  if (!sql) throw NO_DB_ERROR();
  try {
    await sql`
      INSERT INTO basilisk_boosts (unit, stake_address, day)
      VALUES (${unit}, ${stakeAddress}, ${day}::date)
    `;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(
        409,
        "Already boosted today",
        "Each stake address gets one free boost per UTC day. Come back after midnight UTC."
      );
    }
    throw err;
  }
}

/** Boost counts per unit over 24h / 7d / today (UTC). Empty rows → zeros. */
export async function getBoostSummary(units: string[]): Promise<BoostSummary[]> {
  const zeros = units.map((unit) => ({ unit, boosts24h: 0, boosts7d: 0, boostsToday: 0 }));
  if (units.length === 0) return [];

  const sql = await getSql();
  if (!sql) return zeros; // graceful no-DB mode

  const rows = (await sql`
    SELECT
      unit,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS boosts_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int  AS boosts_7d,
      COUNT(*) FILTER (WHERE day = (NOW() AT TIME ZONE 'utc')::date)::int  AS boosts_today
    FROM basilisk_boosts
    WHERE unit = ANY(${units})
    GROUP BY unit
  `) as Array<{ unit: string; boosts_24h: number; boosts_7d: number; boosts_today: number }>;

  const byUnit = new Map(rows.map((r) => [r.unit, r]));
  return units.map((unit) => {
    const r = byUnit.get(unit);
    return {
      unit,
      boosts24h: r?.boosts_24h ?? 0,
      boosts7d: r?.boosts_7d ?? 0,
      boostsToday: r?.boosts_today ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface CommunityComment {
  id: number;
  /** Full stake address — public on-chain data. */
  stakeAddress: string;
  /** Abbreviated "stake1uy…abcd" for display. */
  stakeShort: string;
  body: string;
  createdAt: string;
}

/**
 * Add a comment (max 10 per stake address per UTC day).
 *
 * @throws ApiError(429) when the daily limit is hit
 * @throws ApiError(503) when no database is configured
 */
export async function addComment(
  unit: string,
  stakeAddress: string,
  body: string,
  signedTs: string
): Promise<CommunityComment> {
  const sql = await getSql();
  if (!sql) throw NO_DB_ERROR();

  // Single guarded statement: the daily cap is enforced inside the INSERT
  // itself (a separate COUNT-then-INSERT races under concurrent lambdas),
  // and UNIQUE(stake_address, signed_ts) rejects replays of a captured
  // signed payload (the ts is signature-bound).
  let rows: Array<{ id: number; stake_address: string; body: string; created_at: string }>;
  try {
    rows = (await sql`
      INSERT INTO basilisk_comments (unit, stake_address, body, signed_ts)
      SELECT ${unit}, ${stakeAddress}, ${body}, ${signedTs}::timestamptz
      WHERE (
        SELECT COUNT(*)::int
        FROM basilisk_comments
        WHERE stake_address = ${stakeAddress}
          AND (created_at AT TIME ZONE 'utc')::date = (NOW() AT TIME ZONE 'utc')::date
      ) < ${COMMENTS_PER_DAY_LIMIT}
      RETURNING id, stake_address, body, created_at
    `) as typeof rows;
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      throw new ApiError(409, "Duplicate comment", "This signed comment was already posted.");
    }
    throw err;
  }

  if (rows.length === 0) {
    throw new ApiError(
      429,
      "Daily comment limit reached",
      `Each stake address can post ${COMMENTS_PER_DAY_LIMIT} comments per UTC day.`
    );
  }

  const row = rows[0]!;
  return {
    id: Number(row.id),
    stakeAddress: row.stake_address,
    stakeShort: shortStake(row.stake_address),
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Latest comments for a unit, newest first (default/max 50). Empty without DB. */
export async function getComments(unit: string, limit = 50): Promise<CommunityComment[]> {
  const sql = await getSql();
  if (!sql) return []; // graceful no-DB mode

  const capped = Math.min(Math.max(1, limit), 50);
  const rows = (await sql`
    SELECT id, stake_address, body, created_at
    FROM basilisk_comments
    WHERE unit = ${unit}
    ORDER BY created_at DESC
    LIMIT ${capped}
  `) as Array<{ id: number; stake_address: string; body: string; created_at: string }>;

  return rows.map((row) => ({
    id: Number(row.id),
    stakeAddress: row.stake_address,
    stakeShort: shortStake(row.stake_address),
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
