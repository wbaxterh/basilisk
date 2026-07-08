---
title: Overview
sidebar_position: 1
---

# For Agents

Basilisk is built agent-native from day one: the same Cardano market data humans see in the app is exposed to AI agents through open, keyless rails. Here is exactly what is real today and what is still being built — no vaporware.

| Status | Capability |
| --- | --- |
| **Live today** | Hosted **MCP server** at `https://basilisk-seven.vercel.app/api/mcp` — screener, token detail, search, wallets, ADA price, chain tip as structured tools |
| **Live today** | Free public **REST API** (`/api/v1`) — no key, no signup |
| **Live today** | **Ask Basilisk**, the in-app assistant — consumes the exact same six tools exposed over MCP (same functions, same coverage honesty) |
| **In development** | **x402 pay-per-query** — HTTP 402 micropayments via Masumi Network's community x402-cardano facilitator (testnet PoC stage) |
| **In development** | **Live trades feed** — per-swap data for tokens and wallets |
| **Research** | **Agent-to-agent settlement** — the Scout×Trader replayable demo (Request → Negotiate → Transact → Evaluate) |

## Start here: connect an agent in one line

```bash
claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp
```

That's it. No account, no key. Ask Claude "what's moving on Cardano today?" and it calls `get_screener` against live data. Full setup for Claude Desktop and Cursor is on the [MCP page](./mcp.md).

## Why agent-native matters

The legacy crypto-data API model assumes a developer logs into a dashboard, signs a ToS, and pastes a key into a config file. That breaks for autonomous agents:

- Agents can't fill in a credit-card form.
- API keys are bearer tokens — sharing them between agents is unsafe.
- Per-seat subscription pricing doesn't match per-request usage.

Basilisk's answer, in order of shipping:

1. **Keyless data now.** The MCP server and `/api/v1` are open, so agents work today with zero onboarding.
2. **Pay-per-query next.** [x402](./x402.md) — the emerging open standard for agent payments, governed by the x402 Foundation under the Linux Foundation — lets an agent pay per request instead of per seat. On Cardano this depends on community facilitator infrastructure that is still at the testnet proof-of-concept stage, so we label it honestly: in development.
3. **Agent-to-agent economics later.** [A2A](./a2a.md) explores agents buying derived signals from each other; today that exists as a replayable demo, not a production rail.

## Coverage note

:::caution
DEX aggregates (prices, volume, liquidity) come from DexScreener, which covers **SundaeSwap + WingRiders only** on Cardano. Every response carries a `coverage` field. If your agent reports these numbers, it should repeat that caveat — never present them as total Cardano volume or liquidity. On-chain and wallet data come from Koios; ADA market data from CoinGecko.
:::

## Where to go next

- [MCP Server](./mcp.md) — connect Claude Code, Claude Desktop, or Cursor; full tool reference. **Live.**
- [x402 Protocol](./x402.md) — pay-per-query plans and the honest state of x402 on Cardano. **In development.**
- [Agent-to-Agent (A2A)](./a2a.md) — the Scout×Trader demo. **Research.**
- [REST API](../api/overview.md) — plain HTTP, if you'd rather skip MCP.
