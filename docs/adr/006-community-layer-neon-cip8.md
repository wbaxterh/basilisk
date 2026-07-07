# ADR-006: Community Layer (Boosts + Discussion) on Neon Postgres with CIP-30/CIP-8 Wallet Signatures

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** @wbaxterh

## Context

TapTools' community features were pay-to-play: a token "Boost" cost **300 ADA**, so visibility went to whoever paid, not to what the community actually cared about. Basilisk wants a community signal (boosts feeding trending, plus per-token discussion) that is free and one-wallet-one-voice — and wants that contrast to be a product differentiator, not just copy.

Constraints from the existing architecture:

- **Phase 0 is zero-infra (ADR-002/003)** — but boosts and comments are inherently stateful writes, so *some* persistence is unavoidable. The waitlist already uses **Neon serverless Postgres** (free tier, lazy schema creation from a route handler), so a DB precedent exists that costs $0 and needs no server.
- **No accounts** — Basilisk has no signup/login and doesn't want one. The natural identity primitive on Cardano is the wallet: every CIP-30 wallet can sign arbitrary data (`signData`, producing CIP-8/COSE structures) with its reward (stake) key, and the signature is verifiable server-side without any session state.
- Signed-but-replayable messages are worthless: a captured boost signature must not be replayable tomorrow, and a captured comment must not be re-postable forever.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Custodial accounts (email/password or OAuth)** | Familiar; easy rate limiting per account | Adds signup friction + credential handling to a product with no accounts; identities are free to mint (weaker than wallets, plus we hold the liability) |
| **Token-gating (must hold X BASI/ADA to boost)** | Strong sybil resistance | Excludes exactly the newcomers we want; requires a token or balance checks; edges back toward pay-to-play |
| **Pay-per-boost (the TapTools model)** | Revenue; trivially sybil-proof | The thing we are explicitly positioning against; visibility auctions corrupt the trending signal |
| **On-chain boosts (tx metadata votes)** | Fully public, verifiable by anyone | Every boost costs a tx fee (~0.17 ADA) and a wallet confirmation round-trip; slow UX; still needs an indexer to read |
| **Free signed boosts on Neon + CIP-8 verification** (chosen) | $0, no accounts, one signature = one boost, replay-protected, serverless | Off-chain trust in our DB; sybil resistance limited to wallet-key possession; needs `DATABASE_URL` configured |

## Decision

Build the community layer in `apps/web/src/lib/community.ts` + `/api/v1/community/*` route handlers, on **Neon serverless Postgres** with **CIP-30 `signData` on the client and CIP-8/COSE verification on the server**:

- **Identity = stake address.** The browser signs with the wallet's reward address (`getRewardAddresses()[0]`, via `signCommunityPayload` in `src/lib/wallet.ts`); the server derives the bech32 `stake1…` address from the submitted 29-byte hex reward address and verifies the COSE_Sign1 signature against the exact payload JSON with `@cardano-foundation/cardano-verify-datasignature`. Any verification failure is a 401. No sessions, no tokens, no accounts.
- **One free boost per stake address per UTC day** — enforced twice: the signed payload must carry `day` equal to today (UTC), and the DB has `UNIQUE (stake_address, day)` (violation → 409). Boosts are per-token (`unit`) and feed 24h/7d/today counts that rank trending. **Explicitly anti-pay-to-play:** no payment, no priced tiers, no boost auctions — the deliberate inverse of TapTools' 300-ADA Boosts.
- **Discussion** — per-token comments, 1–500 chars, max 10 per stake address per UTC day, newest-first reads (limit 50). Stake addresses are public on-chain data, so both the full address and a `stake1uy…abcd` short form are returned.
- **Replay protection via payload binding, not nonces:** boost payloads bind `{action:"boost", unit, day}` where `day` must equal today UTC — a captured signature is worthless after midnight and can't be redirected to another token, and the uniqueness constraint absorbs same-day replays idempotently-ish (409). Comment payloads bind `{action:"comment", unit, body, ts}` with `ts` required within ±5 minutes of server time, and the `unit` must match the route. No server-side nonce table needed.
- **Graceful no-DB mode:** with no `DATABASE_URL`/`POSTGRES_URL`/`NEON_DATABASE_URL` set, reads return empty summaries/lists and writes fail 503 with a clear hint. Schema is created lazily on first use (`CREATE TABLE IF NOT EXISTS`), same pattern as the waitlist.

## Consequences

### Positive
- **Democratic trending signal** — one wallet signature = one boost/day; ranking cannot be bought, which is a factual, checkable contrast with the incumbent model
- **Zero new services** — Neon is serverless and already in the stack; verification is a pure function in the route handler
- **No accounts, no PII** — the only identity stored is the stake address, which is already public on-chain data
- **Replay-safe by construction** — day-bound and ts-bound payloads mean captured signatures expire; nothing to garbage-collect

### Negative
- **Sybil resistance is real but bounded** — generating fresh wallets (and thus stake keys) is free, so a motivated actor can mint boosts across many addresses. The signature requirement raises effort above "curl in a loop", but this is honesty-level "spam-resistant", not "sybil-proof". Mitigations (minimum wallet age/balance checks via Koios, anomaly detection) are deliberately deferred until abuse is observed
- **Off-chain trust** — boosts/comments live in our Postgres, not on-chain; users must trust us not to tamper (acceptable for a trending signal, would not be for votes with monetary consequences)
- **DB becomes a hard dependency for writes** — the first stateful store in an otherwise stateless app; Neon free-tier limits (connections, storage) now matter
- **No moderation tooling yet** — comments have length/rate limits but no report/delete/block flows; the 10/day cap is the only spam brake
- **Clock skew** — the ±5-minute comment window can reject clients with wrong clocks (they must re-sign)

### Follow-up work
- Add moderation primitives (hide/report, address denylist) before traffic grows
- Revisit sybil mitigations (Koios-backed wallet-age/balance heuristics) if boost gaming appears
- Consider periodic public snapshots of boost tallies (e.g. a signed daily export) to make the off-chain trust checkable
