---
title: Overview
sidebar_position: 1
---

# For Agents

Basilisk is the first Cardano analytics platform built for autonomous AI agents. Two rails:

| Rail | Use it for |
| --- | --- |
| **x402 micropayments** | Pay-per-request access to Basilisk APIs in native ADA. No accounts, no keys. |
| **MCP server** | Plug Basilisk into any LLM (Claude, GPT, open-source) as a structured tool surface. |

Together they let an agent (a) query market data, (b) analyze portfolios, and (c) reason and execute — without a human in the loop and without a SaaS contract.

## Why this exists

The legacy crypto-data API model assumes a developer logs into a dashboard, signs a ToS, and pastes a key into a config file. That model breaks for autonomous agents:

- Agents can't fill in a credit-card form.
- API keys are bearer tokens — sharing them between agents is unsafe.
- Per-seat pricing doesn't match per-request usage.

x402 is a 30-year-old HTTP status code (`402 Payment Required`) revived as a settlement protocol. An agent sends a request, the server replies with a price + payment receiver, the agent signs a tiny Cardano transaction, and the server unlocks the response. No accounts, no keys, no shared state.

## Quick example

```typescript
import { BasiliskAgent } from '@basilisk/agent';

const agent = new BasiliskAgent({ wallet: myCardanoWallet });

const price = await agent.x402.get('/v1/prices/MIN');
// → { price: 0.052, change24h: 4.1, volume24h: 120000 }
// Internally signed a 1000-lovelace (0.001 ADA) tx and forwarded it.
```

## What's next

- [x402 Protocol](./x402) — request/response flow, pricing schedule, settlement
- [MCP Server](./mcp) — connecting Claude / any LLM
- [Agent-to-Agent (A2A)](./a2a) — discovery, negotiation, multi-agent strategies

## Alpha status

Agent rails are in **closed alpha** with design partners through Q4 2026. To get an invite, join the waitlist on [basilisk-seven.vercel.app](https://basilisk-seven.vercel.app) and mention "agents" in the optional notes field.
