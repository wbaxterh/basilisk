---
title: Overview
sidebar_position: 1
---

# REST API

The Basilisk REST API is the exact data plane that powers [basilisk-seven.vercel.app](https://basilisk-seven.vercel.app) — the token screener, token detail pages with candlestick charts, wallet lookup, ADA market stats, and the community boosts + discussion layer. Same routes, same responses.

It is **free and public today**. No API key, no signup, no credit card.

> **TapTools API user?** TapTools shut down in June 2026. See the [migration guide](./taptools-migration.md) for an endpoint-by-endpoint mapping.

## Base URL

```
https://basilisk-seven.vercel.app/api/v1
```

`GET /api/v1` returns a self-describing index of every endpoint with live example URLs:

```bash
curl https://basilisk-seven.vercel.app/api/v1
```

## Authentication

**None required today.** All endpoints are open.

API keys arrive later with a Pro tier (higher limits, more history). Pay-per-query via x402 is [in development](../agents/x402.md) — neither is required for anything documented on this page.

## Coverage caveats — read this first

:::caution Where the data comes from
- **DEX data: SundaeSwap + WingRiders via DexScreener, plus Minswap + SaturnSwap via GeckoTerminal.** DexScreener indexes only SundaeSwap + WingRiders on Cardano; GeckoTerminal adds Minswap and SaturnSwap pools. The two sets are disjoint, so screener and token-detail aggregates merge them without double counting. When the merge contributed data, the `coverage` field reads `"SundaeSwap + WingRiders via DexScreener · Minswap + SaturnSwap via GeckoTerminal"`; if GeckoTerminal is unavailable, responses degrade to DexScreener-only numbers with `"SundaeSwap + WingRiders via DexScreener"`. Either way, these are **not** "total Cardano volume" or "total Cardano liquidity" — say so in your UI too.
- **OHLCV candles: GeckoTerminal, top pool only.** The chart endpoint reads one pool's candles (by default the token's deepest GeckoTerminal pool, in practice Minswap) — not an all-DEX aggregate. Each response names the exact pool it read. Tokens with no GeckoTerminal-indexed pool have no chart yet.
- **On-chain and wallet data: Koios** (community-run Cardano API) — balances, holdings, asset info, supply, holder estimates, chain tip.
- **ADA market + ecosystem list: CoinGecko** — CEX+DEX pricing, a different universe from the DexScreener figures. Don't mix the two in one aggregate.
- **$handle resolution: handle.me**, with an on-chain Koios fallback.
- **Community boosts + comments: Basilisk's own database** — free, wallet-signed, off-chain.
:::

## Rate expectations

There are no hard per-key limits yet because there are no keys — but **be gentle**:

- Responses are cached **30–90 seconds server-side** (module cache + CDN `Cache-Control: s-maxage`). Polling faster than the cache TTL just returns the same bytes.
- Upstreams (Koios public tier, keyless CoinGecko, DexScreener) have their own budgets. Basilisk batches, caches, and serves stale-on-error, but abusive traffic degrades the service for everyone and will get rate-limited when keys ship.

| Endpoint | Server-side cache |
| --- | --- |
| `GET /api/v1` | 300 s |
| `GET /api/v1/tokens` | 45 s |
| `GET /api/v1/tokens/{asset}` | 60 s |
| `GET /api/v1/tokens/{asset}/ohlcv` | per-timeframe: ~30 s for `1m` up to ~300 s for `1d`/`1w` (CDN + module cache per pool+timeframe) |
| `GET /api/v1/tokens/{asset}/logo` | ~1 day CDN cache for PNG/redirect responses; shorter (negative cache) for monogram fallbacks |
| `GET /api/v1/search` | 30 s |
| `GET /api/v1/wallet/{address}` | 30 s |
| `GET /api/v1/market` | 90 s |
| `GET /api/v1/community/boosts` | 30 s |
| `GET /api/v1/community/comments/{unit}` | 15 s |

The OHLCV endpoint deserves extra gentleness: GeckoTerminal's free tier is roughly **10 calls per minute** upstream. Basilisk caches hard specifically so you don't have to think about that — cache TTLs scale with the timeframe (~30 s for `1m`, ~60 s for `5m`/`15m`, ~120 s for `1h`/`4h`/`12h`, ~300 s for `1d`/`1w`), and polling faster than the timeframe's TTL is pure waste.

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/v1` | Self-describing API index |
| `GET /api/v1/tokens` | Screener: curated Cardano native tokens with live price, volume, liquidity, txns |
| `GET /api/v1/tokens/{asset}` | Token detail by asset unit (`policyId` + `assetNameHex`) |
| `GET /api/v1/tokens/{asset}/ohlcv` | OHLCV candles (`tf=1m\|5m\|15m\|1h\|4h\|12h\|1d\|1w`, `quote=usd\|ada`) from a GeckoTerminal pool, with `poolChoices` for pool switching |
| `GET /api/v1/tokens/{asset}/logo` | Token logo — **always returns an image** (registry PNG, `302` redirect, or SVG monogram) |
| `GET /api/v1/search?q=` | Search Cardano tokens by ticker or name |
| `GET /api/v1/wallet/{address}` | Wallet overview for `addr1...`, `stake1...`, or `$handle` |
| `GET /api/v1/market` | ADA market snapshot + price series + optional ecosystem list |
| `GET /api/v1/community/boosts?units=` | Boost counts (24h / 7d / today) per token |
| `POST /api/v1/community/boosts` | Cast today's free boost — wallet-signed (CIP-30 `signData`) |
| `GET /api/v1/community/comments/{unit}` | Latest 50 comments for a token |
| `POST /api/v1/community/comments/{unit}` | Post a comment — wallet-signed (CIP-30 `signData`) |

### `GET /api/v1/tokens` — screener

Curated registry tokens enriched with live DexScreener data (aggregated per token across pairs), plus Minswap liquidity/volume merged in from GeckoTerminal, sorted by merged liquidity.

```bash
curl https://basilisk-seven.vercel.app/api/v1/tokens
```

```json
{
  "coverage": "SundaeSwap + WingRiders via DexScreener · Minswap + SaturnSwap via GeckoTerminal",
  "updatedAt": "2026-07-06T18:04:11.000Z",
  "count": 42,
  "tokens": [
    {
      "address": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
      "symbol": "SNEK",
      "name": "Snek",
      "imageUrl": "https://…",
      "priceUsd": 0.0021,
      "change1h": 0.4,
      "change6h": -1.2,
      "change24h": 3.8,
      "volume24h": 184223.5,
      "liquidityUsd": 2410331.2,
      "marketCap": 158000000,
      "fdv": 158000000,
      "buys24h": 412,
      "sells24h": 371,
      "txns24h": 783,
      "pairCount": 3,
      "dexIds": ["sundaeswap", "wingriders", "minswap"],
      "topPairAddress": "…",
      "pairCreatedAt": 1683131323000
    }
  ]
}
```

### `GET /api/v1/tokens/{asset}` — token detail

`{asset}` is the Cardano asset unit: 56-hex-char policy id + asset name hex, concatenated. Adds per-pair rows and Koios on-chain facts (supply, decimals, fingerprint, mint time, estimated holders). Pair rows carry a `source` field: `"dexscreener"` (SundaeSwap/WingRiders) or `"geckoterminal"` (Minswap — GeckoTerminal doesn't expose per-pool buy/sell counts, so those rows report `0`; render "—", not zero).

```bash
curl https://basilisk-seven.vercel.app/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b
```

```json
{
  "address": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  "symbol": "SNEK",
  "name": "Snek",
  "priceUsd": 0.0021,
  "coverage": "SundaeSwap + WingRiders via DexScreener · Minswap + SaturnSwap via GeckoTerminal",
  "pairs": [
    {
      "dexId": "sundaeswap",
      "pairAddress": "…",
      "quoteSymbol": "ADA",
      "priceUsd": 0.0021,
      "liquidityUsd": 1804211.7,
      "volume24h": 121092.4,
      "buys24h": 280,
      "sells24h": 244,
      "url": "https://dexscreener.com/cardano/…",
      "source": "dexscreener"
    },
    {
      "dexId": "minswap",
      "pairAddress": "f5808c2c990d86da54bfc97d89cee6efa20cd8…",
      "quoteSymbol": "ADA",
      "priceUsd": 0.0021,
      "liquidityUsd": 905112.3,
      "volume24h": 48211.9,
      "buys24h": 0,
      "sells24h": 0,
      "url": "https://www.geckoterminal.com/cardano/pools/f5808c…",
      "source": "geckoterminal"
    }
  ],
  "policyId": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f5",
  "assetNameHex": "34e454b",
  "fingerprint": "asset108xu02ckwrfc8qs9d97mgyh4kn8gdu9w8f5sxk",
  "totalSupply": "76715880000",
  "decimals": 0,
  "creationTime": 1683131323,
  "description": "The chillest meme coin on Cardano.",
  "holders": 41461
}
```

Holder counts are Koios **estimates** (`Prefer: count=estimated`) and may be `null` on a cold cache — retry a minute later.

### `GET /api/v1/tokens/{asset}/ohlcv` — candlestick chart data

OHLCV candles from **GeckoTerminal** — the only free source with Minswap coverage. By default the endpoint charts the token's **deepest GeckoTerminal pool** (in practice its main Minswap pool); pass `?pool=<address hex>` (from the token's pairs list or the response's `poolChoices`) to chart a specific pool instead. The response names exactly which pool it read — the chart is **that pool's candles, not an all-DEX aggregate**.

- `?tf=1m|5m|15m|1h|4h|12h|1d|1w` — timeframe (default `1h`)
- `?quote=usd|ada` — denomination (default `usd`). `ada` **re-bases the USD candles against ADA's USD price** — derived, not exchange-native quotes
- `?limit=1..500` — number of candles (default `300`)
- `?pool=<hex>` — chart a specific pool address instead of the top pool

```bash
curl "https://basilisk-seven.vercel.app/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b/ohlcv?tf=1h&limit=3"
```

```json
{
  "asset": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  "pool": {
    "address": "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c2ffadbb8…",
    "dexId": "minswap",
    "name": "SNEK / ADA"
  },
  "tf": "1h",
  "quote": "USD",
  "poolChoices": [
    { "address": "f5808c2c990d86da54bfc97d89cee6efa20cd8…", "dexId": "minswap", "name": "SNEK / ADA" },
    { "address": "3a1c9e0b7712fd0166b4dc20aa0f2c9e88b1a4…", "dexId": "minswap", "name": "SNEK / iUSD" }
  ],
  "candles": [
    { "time": 1783371600, "open": 0.000415, "high": 0.000420, "low": 0.000415, "close": 0.000420, "volume": 391.64 },
    { "time": 1783375200, "open": 0.000420, "high": 0.000420, "low": 0.000412, "close": 0.000412, "volume": 735.98 },
    { "time": 1783378800, "open": 0.000412, "high": 0.000420, "low": 0.000412, "close": 0.000420, "volume": 185.03 }
  ],
  "coverage": "Chart: top pool via GeckoTerminal (includes Minswap)"
}
```

Notes:

- `time` is Unix **seconds** (UTC), candles ascending. GeckoTerminal returns USD-denominated prices **and** volume even for ADA-quoted pools; `?quote=ada` values are **derived** by re-basing against ADA's USD price, not read from the pool.
- `poolChoices` lists the token's chartable GeckoTerminal pools (address, dex, name) so UIs can offer a pool switcher — feed an entry's `address` back as `?pool=`.
- Tokens with no GeckoTerminal-indexed pool (i.e. liquidity only on SundaeSwap/WingRiders) return **404 "No chartable pool found"** — no chart yet, honestly, until Basilisk's own ingestion lands.
- GeckoTerminal's free tier is ~10 calls/min; responses are cached server-side **per timeframe** — ~30 s for `1m`, ~60 s for `5m`/`15m`, ~120 s for `1h`/`4h`/`12h`, ~300 s for `1d`/`1w`. Don't poll faster than the TTL.

### `GET /api/v1/tokens/{asset}/logo` — token logo

**Always returns an image** — point an `<img src>` at it and never handle a 404. Resolution is tiered:

1. **Cardano Token Registry PNG** (via Koios) — served as `image/png` after PNG magic-byte validation, with a **long CDN cache** (`Cache-Control: s-maxage` on the order of a day). Covers the full curated registry today.
2. **`302` redirect** to a precomputed GeckoTerminal-hosted image for tokens without registry art.
3. **Deterministic SVG monogram** (`image/svg+xml`) as the final fallback — same token, same art, every time. Served with a **shorter cache TTL** (negative cache) so tokens that later gain registry art pick it up automatically.

```bash
curl -I https://basilisk-seven.vercel.app/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b/logo
```

Check the `Content-Type` (`image/png` or `image/svg+xml`) or a `302 Location` header if you care which tier answered — browsers don't need to. Registry PNGs are served at their submitted size (~33 KB average); pre-sized variants are on the roadmap. Design details in [ADR-008](https://github.com/wbaxterh/basilisk/blob/main/docs/adr/008-token-logo-pipeline.md).

### `GET /api/v1/search?q=` — token search

DexScreener search filtered to Cardano and deduplicated by base token.

```bash
curl "https://basilisk-seven.vercel.app/api/v1/search?q=SNEK"
```

```json
{
  "coverage": "SundaeSwap + WingRiders via DexScreener",
  "query": "SNEK",
  "count": 2,
  "tokens": [ { "address": "279c…454b", "symbol": "SNEK", "priceUsd": 0.0021 } ]
}
```

### `GET /api/v1/wallet/{address}` — wallet overview

Accepts a payment address (`addr1...`), a stake address (`stake1...`), or an ADA Handle (`$handle` — URL-encode `$` as `%24`). Balances and holdings via Koios; USD prices where DexScreener covers the token (unpriced holdings keep `valueUsd: null` instead of being dropped).

```bash
curl https://basilisk-seven.vercel.app/api/v1/wallet/%24wes
curl https://basilisk-seven.vercel.app/api/v1/wallet/stake1u9xyz…
```

```json
{
  "input": "$wes",
  "stakeAddress": "stake1u9xyz…",
  "adaBalance": 1523.44,
  "adaValueUsd": 852.1,
  "rewards": 12.03,
  "pool": "pool1abc…",
  "holdings": [
    {
      "unit": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
      "name": "Snek",
      "ticker": "SNEK",
      "decimals": 0,
      "quantity": "1500000",
      "priceUsd": 0.0021,
      "valueUsd": 3150,
      "priceSource": "SundaeSwap + WingRiders via DexScreener"
    }
  ],
  "totalValueUsd": 4002.1,
  "coverage": "SundaeSwap + WingRiders via DexScreener"
}
```

### `GET /api/v1/market` — ADA market

ADA snapshot + USD price series, and optionally the CoinGecko `cardano-ecosystem` list.

- `?days=1..365` — series granularity (1 → 5-minute points, 7 → hourly, …)
- `?ecosystem=1` — include the top-50 ecosystem tokens (CoinGecko pricing, **not** DexScreener coverage)

```bash
curl "https://basilisk-seven.vercel.app/api/v1/market?days=1&ecosystem=1"
```

```json
{
  "ada": { "priceUsd": 0.5594, "change24h": 1.9, "marketCap": 19773000000, "volume24h": 412000000 },
  "series": [[1751791200000, 0.5581], [1751791500000, 0.5590]],
  "ecosystem": [
    { "id": "snek", "symbol": "SNEK", "name": "Snek", "priceUsd": 0.0021, "change24h": 3.8, "marketCap": 158000000, "volume24h": 9200000 }
  ]
}
```

## Community endpoints — wallet-signed, free

Boosts and comments are **free** and identified by Cardano wallet signature — no account, no API key, and no payment. One stake address gets **one boost per UTC day** (contrast: TapTools' Boosts cost 300 ADA per boost — here visibility is signed for, not paid for). Comments are capped at 10 per stake address per day.

### The signed-payload contract (POST endpoints)

Writes require a **CIP-30 `signData`** signature made with the wallet's **reward (stake) address**, verified server-side as CIP-8/COSE. The flow in the browser:

1. Build the payload object (see per-endpoint shapes below) and `JSON.stringify` it.
2. `rewardAddressHex = (await api.getRewardAddresses())[0]` — a 29-byte hex mainnet reward address (`e1`-prefixed).
3. `{ signature, key } = await api.signData(rewardAddressHex, hex(utf8(payloadJson)))`.
4. POST `{ payload, signature, key, rewardAddressHex }` — where `payload` is the **exact JSON string** you signed (the server verifies byte-for-byte).

Replay protection is baked into the payloads: boost payloads must carry `day` equal to **today (UTC)**, and comment payloads must carry an ISO `ts` within **±5 minutes** of server time. A captured signature expires on its own — re-sign to retry.

### `GET /api/v1/community/boosts?units=` — boost counts

Boost summaries (24h / 7d / today UTC) for up to 60 comma-separated asset units. Tokens nobody has boosted return zeros.

```bash
curl "https://basilisk-seven.vercel.app/api/v1/community/boosts?units=279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b"
```

```json
{
  "summaries": [
    {
      "unit": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
      "boosts24h": 4,
      "boosts7d": 19,
      "boostsToday": 2
    }
  ]
}
```

### `POST /api/v1/community/boosts` — cast today's boost

Signed payload shape: `{"action":"boost","unit":"<policyId+assetNameHex>","day":"YYYY-MM-DD"}` — `day` must be today (UTC).

```bash
curl -X POST https://basilisk-seven.vercel.app/api/v1/community/boosts \
  -H "Content-Type: application/json" \
  -d '{
    "payload": "{\"action\":\"boost\",\"unit\":\"279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b\",\"day\":\"2026-07-06\"}",
    "signature": "<COSE_Sign1 CBOR hex from signData>",
    "key": "<COSE_Key CBOR hex from signData>",
    "rewardAddressHex": "e1<56 hex chars>"
  }'
```

`201 { "ok": true, "stakeAddress": "stake1u…", "unit": "…" }` on success. `409 "Already boosted today"` if this stake address already used its daily boost (any token — one boost per wallet per day, period). `401` if the signature doesn't verify.

### `GET /api/v1/community/comments/{unit}` — token discussion

Latest 50 comments, newest first. Stake addresses are public on-chain data; both the full address and a short display form are returned.

```bash
curl https://basilisk-seven.vercel.app/api/v1/community/comments/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b
```

```json
{
  "unit": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  "count": 1,
  "comments": [
    {
      "id": 42,
      "stakeAddress": "stake1uyabc…",
      "stakeShort": "stake1uy…abcd",
      "body": "Minswap pool depth looking healthy today.",
      "createdAt": "2026-07-06T18:22:41.000Z"
    }
  ]
}
```

### `POST /api/v1/community/comments/{unit}` — post a comment

Signed payload shape: `{"action":"comment","unit":"<unit>","body":"1-500 chars","ts":"<ISO timestamp>"}` — `unit` must match the URL, `ts` within ±5 minutes of server time.

```bash
curl -X POST https://basilisk-seven.vercel.app/api/v1/community/comments/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b \
  -H "Content-Type: application/json" \
  -d '{
    "payload": "{\"action\":\"comment\",\"unit\":\"279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b\",\"body\":\"Minswap pool depth looking healthy today.\",\"ts\":\"2026-07-06T18:22:00.000Z\"}",
    "signature": "<COSE_Sign1 CBOR hex from signData>",
    "key": "<COSE_Key CBOR hex from signData>",
    "rewardAddressHex": "e1<56 hex chars>"
  }'
```

`201` with the saved comment on success; `429` after 10 comments in a UTC day; `401` on signature failure; `400` if `ts` drifted outside the 5-minute window (re-sign and retry).

## Errors

Errors are JSON with an `error` message and usually a `hint`:

```json
{
  "error": "Token not found",
  "hint": "No DexScreener pairs and no Koios asset info for this unit. Expected {policyId}{assetNameHex}, e.g. 279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b (SNEK)."
}
```

| Status | Meaning |
| --- | --- |
| `400` | Bad input (malformed asset unit, empty query, unrecognized wallet input, bad timeframe, stale/mismatched signed payload) |
| `401` | Wallet signature verification failed (community POST endpoints) |
| `404` | Not found (unknown token, handle, or address; no chartable GeckoTerminal pool) |
| `409` | Already boosted today (one free boost per stake address per UTC day) |
| `413` | Request body too large (community POSTs are capped at 8 KB) |
| `429` | Daily comment limit reached (10 per stake address per UTC day) |
| `502` | An upstream (DexScreener / GeckoTerminal / Koios / CoinGecko) failed and no cached copy existed |
| `503` | Community database not configured on this deployment |

## SDKs

None yet — the API is plain keyless REST, so any HTTP client works as-is. If you're building an **AI agent**, skip HTTP entirely and use the hosted [MCP server](../agents/mcp.md): the same data as structured tools, live today.
