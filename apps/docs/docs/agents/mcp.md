---
title: MCP Server
sidebar_position: 3
---

# MCP Server

**Status: Live.**

Basilisk runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) server for Cardano market data. It speaks **streamable HTTP**, requires **no API key**, and exposes the same data as the [REST API](../api/overview.md) as structured tools any MCP client can call.

```
https://basilisk-seven.vercel.app/api/mcp
```

## Connect

### Claude Code (CLI)

```bash
claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp
```

Then ask things like *"what are the top Cardano tokens by liquidity right now?"* or *"what's in the wallet $wes?"* — Claude picks the right tool.

### Claude Desktop

Settings → Connectors → **Add custom connector**, URL `https://basilisk-seven.vercel.app/api/mcp`.

Or via the config file (`claude_desktop_config.json`), using `mcp-remote` to bridge stdio to the remote HTTP server:

```json
{
  "mcpServers": {
    "basilisk": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://basilisk-seven.vercel.app/api/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "basilisk": {
      "url": "https://basilisk-seven.vercel.app/api/mcp"
    }
  }
}
```

Any other MCP client that supports streamable HTTP transport works the same way — point it at the URL above.

## Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_screener` | none | Curated token screener: live price, volume, liquidity, txns per token |
| `search_tokens` | `query` (ticker or name) | Matching Cardano tokens with market data |
| `get_token` | `asset` (policyId + assetNameHex) | Full token detail: per-DEX pairs, supply, decimals, fingerprint, holders |
| `get_wallet` | `address` (`addr1...`, `stake1...`, or `$handle`) | ADA balance, rewards, pool, holdings with USD values |
| `get_ada_price` | none | ADA market snapshot (price, 24h change, market cap, volume) |
| `get_chain_tip` | none | Current Cardano chain tip (block, epoch, slot, hash, time) |

### `get_screener`

No arguments. Returns the curated screener sorted by liquidity:

```json
{
  "coverage": "SundaeSwap + WingRiders via DexScreener",
  "updatedAt": "2026-07-06T18:04:11.000Z",
  "count": 42,
  "tokens": [
    { "symbol": "SNEK", "priceUsd": 0.0021, "change24h": 3.8, "volume24h": 184223.5, "liquidityUsd": 2410331.2, "txns24h": 783 }
  ]
}
```

### `search_tokens`

```json
{ "query": "SNEK" }
```

Returns Cardano tokens matching the ticker or name, deduplicated and sorted by liquidity — same shape as the screener, plus the `query` echoed back.

### `get_token`

```json
{ "asset": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b" }
```

The asset unit is the 56-hex-char policy id concatenated with the asset name hex. Returns aggregated market data plus per-pair rows and on-chain facts:

```json
{
  "symbol": "SNEK",
  "priceUsd": 0.0021,
  "pairs": [ { "dexId": "sundaeswap", "quoteSymbol": "ADA", "liquidityUsd": 1804211.7, "volume24h": 121092.4 } ],
  "totalSupply": "76715880000",
  "decimals": 0,
  "fingerprint": "asset108xu02ckwrfc8qs9d97mgyh4kn8gdu9w8f5sxk",
  "holders": 41461,
  "coverage": "SundaeSwap + WingRiders via DexScreener"
}
```

### `get_wallet`

```json
{ "address": "$wes" }
```

Accepts a payment address, stake address, or ADA Handle. Returns:

```json
{
  "stakeAddress": "stake1u9xyz…",
  "adaBalance": 1523.44,
  "adaValueUsd": 852.1,
  "rewards": 12.03,
  "pool": "pool1abc…",
  "holdings": [ { "ticker": "SNEK", "quantity": "1500000", "priceUsd": 0.0021, "valueUsd": 3150 } ],
  "totalValueUsd": 4002.1
}
```

### `get_ada_price`

No arguments.

```json
{ "priceUsd": 0.5594, "change24h": 1.9, "marketCap": 19773000000, "volume24h": 412000000 }
```

### `get_chain_tip`

No arguments.

```json
{ "block": 12094211, "epoch": 573, "epochSlot": 201455, "hash": "a1b2…", "blockTime": 1751824111 }
```

## Coverage note

:::caution
DEX aggregates come from DexScreener, which covers **SundaeSwap + WingRiders only** on Cardano. Tool responses carry a `coverage` field — an agent relaying these numbers should repeat the caveat rather than presenting them as total Cardano volume/liquidity. Wallet and on-chain data come from Koios; ADA market data from CoinGecko.
:::

## Notes for agent builders

- **No auth today.** No key, no OAuth. Paid tiers and [x402 pay-per-query](./x402.md) come later; the current tool surface stays free.
- **Caching.** Responses are cached 15–90 s server-side. Calling the same tool in a tight loop returns the same data — don't burn tokens re-asking.
- **Read-only.** Every tool is a pure read. There is no trading, signing, or transaction submission — and there won't be until the settlement work graduates from [research](./a2a.md).
