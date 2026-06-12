---
title: Overview
sidebar_position: 1
---

# Getting Started

Basilisk has three surfaces, depending on who you are:

## 1. Trader — use the app

Head to **[basilisk-seven.vercel.app](https://basilisk-seven.vercel.app)** and request early access. Once you're in, you can:

- Connect a Cardano wallet (CIP-30: Lace, Eternl, Nami, Typhon, Flint) or watch any address
- See live charts and OHLCV candles for every major DEX
- Track portfolio value, P&L, and holdings over time
- Set alerts on price, % moves, or whale activity
- Screen the market — top tokens, gainers, losers, trending

No setup beyond a wallet (or just an email). The free tier covers everything most traders need.

## 2. Developer — use the API

The REST API gives you the same data that powers the UI. Free tier with generous limits.

```bash
curl https://basilisk-seven.vercel.app/api/v1/prices/cardano \
  -H "X-API-Key: $BASILISK_KEY"
```

→ See [REST API → Overview](../api/overview) for endpoints, keys, and rate limits.

## 3. AI Agent — use x402 + MCP

Basilisk is the first Cardano analytics platform built for autonomous agents. No accounts. No API keys. Just pay per request in native ADA via the x402 payment protocol, or connect via the Model Context Protocol (MCP) for LLM tool use.

→ See [For Agents → Overview](../agents/overview) for setup.

## What's not in scope (yet)

The MVP focuses on analytics + portfolio + alerts + API. **Not in MVP**: in-app swaps, NFT analytics suite, mobile apps, embeddable widgets. See the [whitepaper](https://basilisk-seven.vercel.app/whitepaper) for the full roadmap.
