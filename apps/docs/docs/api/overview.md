---
title: Overview
sidebar_position: 1
---

# REST API

The Basilisk REST API is the exact data plane that powers [basilisk-seven.vercel.app](https://basilisk-seven.vercel.app) — the token screener, token detail pages, wallet lookup, and ADA market stats. Same routes, same responses.

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
- **DEX data: SundaeSwap + WingRiders via DexScreener.** DexScreener indexes only these two DEXes on Cardano (no Minswap). Prices, volume, liquidity, and txn counts are aggregates over that coverage — they are **not** "total Cardano volume" or "total Cardano liquidity". Every aggregate response carries a `coverage` field (`"SundaeSwap + WingRiders via DexScreener"`) so your UI can say so too.
- **On-chain and wallet data: Koios** (community-run Cardano API) — balances, holdings, asset info, supply, holder estimates, chain tip.
- **ADA market + ecosystem list: CoinGecko** — CEX+DEX pricing, a different universe from the DexScreener figures. Don't mix the two in one aggregate.
- **$handle resolution: handle.me**, with an on-chain Koios fallback.
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
| `GET /api/v1/search` | 30 s |
| `GET /api/v1/wallet/{address}` | 30 s |
| `GET /api/v1/market` | 90 s |

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/v1` | Self-describing API index |
| `GET /api/v1/tokens` | Screener: curated Cardano native tokens with live price, volume, liquidity, txns |
| `GET /api/v1/tokens/{asset}` | Token detail by asset unit (`policyId` + `assetNameHex`) |
| `GET /api/v1/search?q=` | Search Cardano tokens by ticker or name |
| `GET /api/v1/wallet/{address}` | Wallet overview for `addr1...`, `stake1...`, or `$handle` |
| `GET /api/v1/market` | ADA market snapshot + price series + optional ecosystem list |

### `GET /api/v1/tokens` — screener

Curated registry tokens enriched with live DexScreener data, aggregated per token across pairs and sorted by liquidity.

```bash
curl https://basilisk-seven.vercel.app/api/v1/tokens
```

```json
{
  "coverage": "SundaeSwap + WingRiders via DexScreener",
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
      "dexIds": ["sundaeswap", "wingriders"],
      "topPairAddress": "…",
      "pairCreatedAt": 1683131323000
    }
  ]
}
```

### `GET /api/v1/tokens/{asset}` — token detail

`{asset}` is the Cardano asset unit: 56-hex-char policy id + asset name hex, concatenated. Adds per-pair rows and Koios on-chain facts (supply, decimals, fingerprint, mint time, estimated holders).

```bash
curl https://basilisk-seven.vercel.app/api/v1/tokens/279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b
```

```json
{
  "address": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b",
  "symbol": "SNEK",
  "name": "Snek",
  "priceUsd": 0.0021,
  "coverage": "SundaeSwap + WingRiders via DexScreener",
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
      "url": "https://dexscreener.com/cardano/…"
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
| `400` | Bad input (malformed asset unit, empty query, unrecognized wallet input) |
| `404` | Not found (unknown token, handle, or address) |
| `502` | An upstream (DexScreener / Koios / CoinGecko) failed and no cached copy existed |

## SDKs

None yet — the API is plain keyless REST, so any HTTP client works as-is. If you're building an **AI agent**, skip HTTP entirely and use the hosted [MCP server](../agents/mcp.md): the same data as structured tools, live today.
