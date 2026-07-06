---
title: Migrating from TapTools
sidebar_position: 2
---

# Migrating from the TapTools API

TapTools shut down in **June 2026** — [taptools.io](https://www.taptools.io) is now a farewell page. For years it was the de-facto market data API for Cardano, powering integrations at teams like jpg.store, DexHunter, Vespr, and CSWAP. Its API had no free tier ($9–199/mo), and when it went dark, integrators were left without a replacement.

Basilisk is filling that vacuum: a free, keyless public API plus a hosted [MCP server](../agents/mcp.md) so AI agents get first-class access — something TapTools never offered.

**What changes for you:**

- **No API key.** TapTools required a paid key in an `x-api-key` header. Basilisk `/api/v1` is open — delete the header, swap the base URL.
- **Base URL:** `https://basilisk-seven.vercel.app/api/v1`
- **Coverage is different (and we label it).** TapTools aggregated most Cardano DEXes. Basilisk's DEX aggregates come from DexScreener, which covers **SundaeSwap + WingRiders only** (no Minswap). Every aggregate response carries a `coverage` field. Treat volume/liquidity as "across covered DEXes", never as chain totals.

## Endpoint mapping

| TapTools category | Example TapTools endpoints | Basilisk equivalent | Status |
| --- | --- | --- | --- |
| Token prices | `POST /token/prices`, `/token/quote` | `GET /api/v1/tokens`, `GET /api/v1/tokens/{asset}` (`priceUsd`, liquidity-weighted) | Live |
| Token market cap / supply | `/token/mcap` | `GET /api/v1/tokens/{asset}` (`marketCap`, `fdv`, `totalSupply`, `decimals`) | Live |
| Top tokens / screener | `/token/top/volume`, `/token/top/mcap` | `GET /api/v1/tokens` (sorted by liquidity; volume/txn fields included) | Live |
| Token holders | `/token/holders` | `GET /api/v1/tokens/{asset}` (`holders`, Koios estimate) | Live (estimate) |
| Token links / socials | `/token/links` | `GET /api/v1/tokens/{asset}` (`websites`, `socials`) | Live |
| Token search | — (dashboard only) | `GET /api/v1/search?q=` | Live |
| Wallet / portfolio positions | `/wallet/portfolio/positions` | `GET /api/v1/wallet/{addr\|stake\|$handle}` (balances, holdings, USD values) | Live |
| Market stats | `/market/stats` | `GET /api/v1/market` (ADA snapshot + series via CoinGecko) | Live (ADA-level) |
| Address / on-chain info | `/address/info` | `GET /api/v1/wallet/{address}` + chain tip (also via [MCP](../agents/mcp.md) `get_chain_tip`) | Live |
| OHLCV candles | `/token/ohlcv` | Own ingestion planned (see [ADR-001](https://github.com/wbaxterh/basilisk/blob/main/docs/adr/001-kupmios-primary-chain-data.md)) | Roadmap |
| Trades feed | `/token/trades` | Live trades feed | Roadmap (in development) |
| Portfolio P&L / trade history | `/wallet/trades`, P&L fields | Requires the trades feed first | Roadmap |
| NFT analytics | `/nft/...` (collections, floors, sales) | Not built | Roadmap (research) |
| DEX aggregator integration | `/integration/...` | Not built | Roadmap (research) |

## Honest gaps

We would rather tell you now than have you discover it in production:

- **No OHLCV candles yet.** DexScreener doesn't expose historical candles via API. Real candles come with our own chain ingestion (Kupmios), which is a later phase.
- **No trades feed yet.** Per-swap data is in development, not live.
- **No NFT analytics.** Token markets first.
- **Coverage is two DEXes**, not the whole chain, until our own ingestion lands.

If one of these gaps is the thing you need most, [open an issue](https://github.com/wbaxterh/basilisk/issues) — the roadmap is genuinely shaped by what former TapTools integrators ask for.

## What you get that TapTools never had

- **A free tier.** The entire v1 API, actually free, no key.
- **Agent-native access.** A hosted [MCP server](../agents/mcp.md) — point Claude, Cursor, or any MCP client at `https://basilisk-seven.vercel.app/api/mcp` and query Cardano markets in natural language.
- **Open source.** The whole stack is public at [github.com/wbaxterh/basilisk](https://github.com/wbaxterh/basilisk). If the data looks wrong, you can read the code that produced it.
