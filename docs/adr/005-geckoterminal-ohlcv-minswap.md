# ADR-005: GeckoTerminal Free API for OHLCV Candles and Minswap Coverage

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** @wbaxterh

## Context

ADR-002's free data plane has two gaps its own Consequences section called out: **no Minswap coverage** (DexScreener indexes only SundaeSwap + WingRiders on Cardano) and **no historical OHLCV candles** (DexScreener exposes none). Both were the top asks from TapTools refugees — Minswap is the largest Cardano DEX by TVL, and a market data product without a price chart is not credible.

The Kupmios ingestion path (ADR-001) solves both permanently but is still weeks of build + recurring cost, which the validation pivot defers until demand is proven. We need candles and Minswap numbers now, at $0.

**GeckoTerminal facts (verified against the live API, 2026-07-06):**

- `GET /networks/cardano/dexes` lists exactly one dex: `minswap-cardano`. Token pool lists also surface occasional `saturnswap` pools, so real coverage is Minswap (dominant) + SaturnSwap — **disjoint from DexScreener's SundaeSwap + WingRiders**, so merging the two sources does not double count.
- Per-pool OHLCV is available at day/hour/minute granularity with aggregation (`15m`, `1h`, `4h`, `1d`), up to 500 candles per call, keyless.
- OHLCV prices **and** volume are USD-denominated even for ADA-quoted pools (verified: hourly close matches `base_token_price_usd`).
- Free budget is tight: GT's swagger docs say "approximately 10 calls per minute, which may fluctuate" (other GT pages cite 30/min — we size for the lower bound). Responses are themselves cached ~1 min upstream.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Build Kupmios ingestion now (ADR-001)** | Own candles, all DEXes, per-swap trades | Weeks of work + infra cost before validation; exactly what the pivot defers |
| **Minswap's own API/SDK** | First-party Minswap data | Single-DEX only, no cross-DEX merge story, no OHLCV history endpoint comparable to GT's |
| **Paid aggregator (CoinGecko Pro / CG onchain paid tier)** | Higher limits, SLA | Recurring cost pre-revenue; contradicts the Phase-0 $0-infra stance |
| **GeckoTerminal free API, merged with DexScreener** (chosen) | $0, keyless, Minswap + OHLCV today, disjoint coverage merges cleanly | ~10 req/min budget, top-pool candles only, USD-only denomination, another upstream dependency |

## Decision

Add **GeckoTerminal** as a second DEX-data upstream, implemented in `apps/web/src/lib/gecko-data.ts` (same module-scope TTL cache + in-flight dedupe + serve-stale-on-error idioms as `dex-data.ts`; helpers are copied locally because importing `dex-data` would create a cycle — `dex-data` imports this module for the merge):

- **OHLCV endpoint** — `GET /api/v1/tokens/{asset}/ohlcv?tf=15m|1h|4h|1d&limit=1..500&pool=<hex>` resolves the token's deepest GT pool (or an explicit `?pool=`), fetches per-pool candles, dedupes/sorts them ascending, and returns USD-denominated candles plus the pool identity. **Charts are top-pool only** — they read one pool's candles (in practice the deepest Minswap pool), not an all-DEX aggregate, and every response says so: `coverage: "Chart: top pool via GeckoTerminal (includes Minswap)"` with the pool address/dex/name in the payload.
- **Screener merge** — `getTokensMulti()` batches the registry through `/networks/cardano/tokens/multi/{…}` (30 units/call, 2 calls per cold refresh, cached 300 s) and adds GT reserve/volume on top of DexScreener aggregates in `getScreener()`.
- **Token detail merge** — `getTokenPools()` (base-side pools only, same quote-side-corruption filter as the DexScreener path) appends Minswap pools to the pairs list with `source: "geckoterminal"`, and totals are recomputed across the deduped union.
- **Combined coverage labeling** — when (and only when) GT actually contributed data, aggregate responses carry `coverage: "SundaeSwap + WingRiders via DexScreener · Minswap + SaturnSwap via GeckoTerminal"`; on any GT failure they degrade to DexScreener-only numbers with the original `"SundaeSwap + WingRiders via DexScreener"` string. Nothing is ever labeled "total Cardano volume".
- **Budget discipline** — TTLs sized for the ~10 req/min floor: token pools 180 s, tokens/multi 300 s per chunk, OHLCV 120 s (60 s for 15m), plus CDN `s-maxage=60` on the OHLCV route and serve-stale-on-error everywhere. GT failures never break a screener or detail response.

## Consequences

### Positive
- **Candles and Minswap ship at $0** — the two loudest ADR-002 gaps close without touching the Kupmios timeline
- **No double counting** — GT (Minswap + SaturnSwap) and DexScreener (SundaeSwap + WingRiders) index disjoint DEX sets, so sums are safe by construction
- **Honesty stays enforced in code** — the combined coverage string is emitted only when GT data was actually merged; chart responses name the exact pool they read
- **Graceful degradation** — every GT call is wrapped so an outage reverts responses to DexScreener-only with the old coverage label

### Negative
- **~10 req/min budget** — the tightest upstream we depend on; aggressive caching is mandatory, and traffic spikes on cold instances can hit 429s (mitigated by serve-stale and CDN caching, not eliminated)
- **Chart = one pool, not the market** — candles reflect the top GT pool only; tokens whose liquidity lives on SundaeSwap/WingRiders (no GT pool) get a 404 and **no chart at all** until ADR-001 ingestion lands
- **USD-only candles** — GT denominates OHLCV in USD even for ADA-quoted pools; ADA-quoted charts are impossible from this source
- **No per-pool buy/sell counts** — GT's pools endpoint lacks them, so merged pair rows carry `source: "geckoterminal"` and zeros that UIs must render as "—"
- **Fifth upstream dependency** — one more free tier that can throttle or change terms

### Follow-up work
- Watch GT 429/error rates; if the budget bites, lengthen TTLs before anything else
- Revisit when ADR-001 ingestion lands: own candles supersede the OHLCV path here, and this merge collapses back to a cross-check
- Consider labeling SaturnSwap explicitly in coverage strings if its pools start contributing materially
