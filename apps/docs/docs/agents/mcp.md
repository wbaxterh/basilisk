---
title: MCP Server
sidebar_position: 3
---

# MCP Server

:::info Coming soon
This page covers the Basilisk MCP (Model Context Protocol) server: how to
connect Claude, GPT, or any LLM tool-use client, the tool surface we expose,
authentication options, and worked examples for portfolio rebalancing agents.

Full content lands when the closed alpha opens. In the meantime see [Overview](./overview).
:::

## At a glance

MCP is Anthropic's open standard for letting LLMs invoke external tools through
a uniform interface. Basilisk's MCP server exposes the same primitives as the
REST API — prices, candles, tokens, wallets, screeners — as structured tools
any compliant agent can call:

```
mcp.connect("https://mcp.basilisk-seven.vercel.app")
tools = mcp.list_tools()
// → [getPrice, getCandles, getWalletHoldings, screenMarket, ...]
```

The server accepts the same x402 micropayments as the REST API, so the same
agent can read and pay through a single rail.
