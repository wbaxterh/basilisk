---
title: Overview
sidebar_position: 1
---

# Getting Started

Basilisk has three surfaces, depending on who you are:

## 1. Trader — use the app

Head to **[basilisk-seven.vercel.app](https://basilisk-seven.vercel.app)**. What you can do today:

- **Screen the market** — curated Cardano native tokens with live price, volume, liquidity, and txns (SundaeSwap + WingRiders via DexScreener · Minswap + SaturnSwap via GeckoTerminal — labeled honestly, never sold as "total Cardano volume")
- **Candlestick charts** — OHLCV candles on token pages (15m / 1h / 4h / 1d), read from the token's top GeckoTerminal pool (in practice its main Minswap pool); the chart labels which pool it's showing
- **Boost tokens & see what's trending** — one **free** boost per wallet per day (CIP-30 signature, no payment — unlike the old TapTools model where a Boost cost 300 ADA), and trending ranks by those community boosts
- **Discuss** — per-token comment threads, wallet-signed, no account needed
- **Watchlist** — keep the tokens you care about one click away
- **Look up any wallet** — `addr1...`, `stake1...`, or `$handle`: balance, rewards, delegation, and holdings with USD values where priced
- **Ask Basilisk** — an in-app AI analyst that answers questions from live screener, token, and wallet data (rate-limited free beta; answers can be wrong — verify before trading)

No account, no signup — connect a CIP-30 wallet (Lace, Eternl, Typhon, …) only when you want to boost or comment.

## 2. Developer — use the API

The REST API gives you the same data that powers the UI — screener, token detail, OHLCV candles, wallets, market, community. **Free and keyless today.**

```bash
curl https://basilisk-seven.vercel.app/api/v1/tokens
```

→ See [REST API → Overview](../api/overview) for endpoints, coverage caveats, and cache/rate expectations.

## 3. AI Agent — use x402 + MCP

Basilisk is built for autonomous agents. No accounts, no API keys: connect via the hosted Model Context Protocol (MCP) server for LLM tool use — live today — and x402 pay-per-request in ADA is in development.

→ See [For Agents → Overview](../agents/overview) for setup.

## What's not in scope (yet)

The MVP focuses on analytics + portfolio + alerts + API. **Not in MVP**: in-app swaps, NFT analytics suite, mobile apps, embeddable widgets. See the [whitepaper](https://basilisk-seven.vercel.app/whitepaper) for the full roadmap.
