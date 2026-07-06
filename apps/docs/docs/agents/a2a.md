---
title: Agent-to-Agent
sidebar_position: 4
---

# Agent-to-Agent (A2A)

**Status: Research.** Nothing on this page is a production rail. What exists today is a **replayable demo** you can run from the repo — and we think that's the right way to explore agent economics: in the open, clearly labeled, with no real funds.

## The Scout × Trader demo

The demo lives in [`scripts/agent-demo/`](https://github.com/wbaxterh/basilisk/tree/main/scripts/agent-demo) in the monorepo. Two agents with different jobs interact over Basilisk's live data:

- **Scout** — watches the market via the same tools as the [MCP server](./mcp.md) (screener, token detail, search) and produces a derived signal: "here's something moving, and here's why".
- **Trader** — holds the budget, verifies it with a live wallet lookup, evaluates Scout's proposal, and decides whether the signal is worth acting on.

Each replay walks one full loop:

```
Request   → Trader asks Scout for a signal matching its criteria
Negotiate → Scout justifies the pick with live data; Trader challenges freshness and sizing
Transact  → Trader verifies balance and emits an UNSIGNED transaction intent — a human approves signing
Evaluate  → Scout re-checks the market against the entry thesis and logs the outcome
```

Because it replays against real market data from the free API, every run is different — and because the loop stops at an unsigned transaction intent, no funds move, real or simulated, and it's safe to run, fork, and break. Settlement via [x402](./x402.md)/Masumi is in development.

## Why this is research, not a product

An honest A2A rail needs three things Basilisk doesn't have in production yet:

1. **Machine payments** — [x402 pay-per-query](./x402.md) is in development; on Cardano the facilitator path (Masumi's community x402-cardano) is at the testnet PoC stage.
2. **Live trade data** — evaluating signals properly wants the per-swap trades feed, which is in development.
3. **Settlement guarantees** — autonomous settlement between agents is exactly the kind of thing that must not be hand-waved. We will not claim autonomous mainnet trading; see [what we will not claim](./x402.md#what-we-will-not-claim).

The demo exists so the negotiation and evaluation loop can be designed and criticized *before* real money is involved, not after.

## The shape of the eventual protocol

Intentionally minimal: discovery, capability description, pricing schedule, signed payment receipt. Strategy, risk, and execution venue stay the agent's business. A2A composes on top of [x402](./x402.md) and [MCP](./mcp.md) — one agent pays another for a derived signal the same way it would pay Basilisk for raw data.

If you run the demo and have opinions, [open an issue](https://github.com/wbaxterh/basilisk/issues) — this is the stage where feedback actually changes the design.
