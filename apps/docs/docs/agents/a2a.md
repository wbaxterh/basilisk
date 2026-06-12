---
title: Agent-to-Agent
sidebar_position: 4
---

# Agent-to-Agent (A2A)

:::info Coming soon
This page covers the Basilisk Agent-to-Agent rails: discovery, capability
negotiation, and settlement between autonomous agents — portfolio rebalancing,
arbitrage detection, and multi-agent trading strategies.

Full content lands once x402 + MCP are out of closed alpha.
:::

## At a glance

A2A composes on top of [x402](./x402) and [MCP](./mcp): one agent can pay
another for a derived signal (e.g. a whale-flow score, a sentiment digest, a
rebalancing recommendation) the same way it pays Basilisk for raw market data.

The protocol is intentionally minimal — discovery, capability description,
pricing schedule, signed-payment receipt. Everything else (strategy, risk,
execution venue) is the agent's call.
