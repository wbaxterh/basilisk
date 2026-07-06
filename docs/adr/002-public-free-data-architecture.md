# ADR-002: Public Free APIs (DexScreener + Koios + CoinGecko + handle.me) as Phase-0 Production Data Plane

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** @wbaxterh

## Context

TapTools — the incumbent Cardano market data API — shut down in June 2026, leaving a vacuum Basilisk wants to fill immediately. ADR-001 selected Kupmios (Ogmios + Kupo) for our own chain ingestion, but standing that up (indexer sync, DEX swap decoding, candle aggregation, ops) is weeks of work and recurring infra cost. Per the validation pivot, we ship a real product on zero infrastructure first and only build ingestion once demand is proven.

We need, today: token prices/volume/liquidity, token on-chain facts, wallet balances/holdings, ADA market data, and $handle resolution — all from a Vercel-hosted Next.js app with no backend services.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Wait for Kupmios ingestion (ADR-001)** | Full coverage, own data | Weeks of build + ops cost before anything ships |
| **Blockfrost free tier for everything** | One provider | No DEX market data (prices/volume/liquidity), 50k req/day |
| **Paid aggregator API** | Broad coverage | Recurring cost pre-revenue; repeats TapTools' single-vendor risk from the consumer side |
| **Free public APIs, composed** (chosen) | $0, live today, each source best-in-class for its slice | Coverage gaps, upstream rate limits, no historical candles |

## Decision

Adopt a composed free-API data plane as the Phase-0 production backend, implemented in `apps/web/src/lib/dex-data.ts` and shared by `/api/v1` route handlers, page server components, and the MCP server:

- **DexScreener** — DEX market data: prices, volume, liquidity, txns, pairs. Keyless.
- **Koios** (public tier) — on-chain data: account/address balances and assets, asset info (supply, decimals, fingerprint), holder estimates, chain tip.
- **CoinGecko** (keyless, optional demo key) — ADA market snapshot, price series, cardano-ecosystem list.
- **handle.me** — $handle → stake address resolution, with a Koios on-chain fallback (CIP-25 and CIP-68 encodings).

Mitigations built into the data layer:

- Module-scope TTL cache (15 s – 24 h by data class) with in-flight dedupe and serve-stale-on-error.
- CDN caching via `Cache-Control: s-maxage` (30–300 s) on every `/api/v1` response.
- Batching within upstream budgets (Koios ~1 kb POST body → 8 assets/call; DexScreener 30 units/call; Koios holder counts via `Prefer: count=estimated` — `count=exact` verified to time out).
- **Coverage honesty as an architectural rule:** DexScreener indexes only SundaeSwap + WingRiders on Cardano. Every aggregate response carries `coverage: "SundaeSwap + WingRiders via DexScreener"`, UIs show a coverage chip, and nothing is ever labeled "total Cardano volume/liquidity".

### Relationship to ADR-001

ADR-001 is **not superseded — it is deferred**. Kupmios remains the Phase-2+ plan and is the only path to the things this decision cannot deliver: full-DEX coverage (including Minswap), OHLCV candles, and a per-swap trades feed. This ADR buys time and users while that demand is validated.

## Consequences

### Positive
- **Live product at ~$0/mo infra** — screener, token detail, wallets, market data shipped without a single backend service
- **Fast enough** — CDN + module cache keep p50 well under upstream latency for warm paths
- **Resilient-ish** — serve-stale-on-error means upstream blips degrade freshness, not availability
- **Honesty is enforced in code** — `coverage` field at the data layer, not left to UI discipline

### Negative
- **Coverage limits** — DEX aggregates cover SundaeSwap + WingRiders only (no Minswap); this must be disclosed everywhere and constrains "market-wide" claims
- **No candles, no trades** — DexScreener exposes no historical OHLCV or per-swap feed; these stay roadmap items until ADR-001 ingestion lands
- **Upstream dependence** — four third-party free tiers; any of them can throttle or change terms (mitigated by caching, batching, and stale-serving — not eliminated)
- **Cold-start warts** — e.g. Koios holder estimates can take ~60 s on cold cache; responses return `null` and backfill

### Follow-up work
- Monitor upstream error rates; add a second market-data source if DexScreener reliability degrades
- Revisit this ADR when: (a) traffic approaches upstream budgets, (b) users demand candles/trades, or (c) revenue justifies ADR-001 ingestion — whichever comes first
