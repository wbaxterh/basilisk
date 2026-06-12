---
title: Overview
sidebar_position: 1
---

# REST API

The Basilisk REST API exposes the same data that powers basilisk-seven.vercel.app: prices, candles, tokens, wallets, portfolios, and screeners across every major Cardano DEX.

> **Status:** Beta. Endpoints and response shapes may still change before v1. Pinning a version (`/v1/…`) gives you breaking-change protection.

## Base URL

```
https://basilisk-seven.vercel.app/api
```

## Authentication

Pass your API key as a header:

```
X-API-Key: bsk_live_xxx
```

Get a key from your dashboard at [basilisk-seven.vercel.app](https://basilisk-seven.vercel.app) → Settings → API Keys. The free tier is generous; usage above the free quota requires a paid plan or x402 micropayments (see [For Agents](../agents/overview)).

## Rate limits

| Tier | Requests / min | Daily cap |
| --- | --- | --- |
| Free | 60 | 50,000 |
| Pro | 600 | 1,000,000 |
| Agent (x402) | per-request payment | none |

Limits are returned in every response as `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

## Response shape

All responses follow a consistent envelope:

```json
{
  "data": { /* … */ },
  "meta": { "requestId": "req_xyz", "timestamp": 1709999999 }
}
```

Errors:

```json
{
  "error": {
    "code": "INVALID_ASSET",
    "message": "Asset not found"
  }
}
```

## Endpoints (MVP)

| Endpoint | Description |
| --- | --- |
| `GET /v1/prices/:asset` | Live VWAP price for a token |
| `GET /v1/candles/:asset` | OHLCV candles (intervals: `1m`, `5m`, `1h`, `1d`) |
| `GET /v1/tokens` | List CNT tokens with market data |
| `GET /v1/tokens/:asset` | Token detail incl. holders, liquidity, contract info |
| `GET /v1/screener/top` | Top tokens by liquidity / market cap |
| `GET /v1/screener/gainers` | 24H gainers |
| `GET /v1/screener/losers` | 24H losers |
| `GET /v1/wallets/:addr` | Wallet profile, balances, P&L |
| `GET /v1/wallets/:addr/history` | Portfolio value-over-time |

Detailed reference pages coming next.

## SDKs

- **TypeScript / JavaScript** — `npm install @basilisk/sdk` *(coming soon)*
- **Python** — `pip install basilisk` *(coming soon)*

For now, the API is plain REST — any HTTP client works.
