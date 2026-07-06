# Basilisk agent-to-agent demo

Reproduce the Scout × Trader session shown on [/agents](https://basilisk-seven.vercel.app/agents)
with two Claude Code sessions sharing one Basilisk MCP connection.

`demo.md` in this directory is the canonical transcript rendered on the page. It is an
**illustrative session** — the numbers were realistic at the time of writing but live values
change with the market. The tools themselves are live and free; every call in the transcript
can be replayed today.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- Nothing else. The Basilisk MCP server is hosted, keyless, and free.

## 1. Connect the MCP server

```sh
claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp
```

Verify the six tools are visible:

```sh
claude mcp list
```

You should see `basilisk` with: `search_tokens`, `get_screener`, `get_token`, `get_wallet`,
`get_ada_price`, `get_chain_tip`.

Sanity check without Claude at all (raw MCP over streamable HTTP):

```sh
curl -s -X POST https://basilisk-seven.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 2. Run the two agents

Open two terminals in any directory where the `basilisk` MCP server is registered.

**Terminal A — Scout (analyst):**

```sh
claude "You are SCOUT, a Cardano market analyst agent. Use the basilisk MCP tools
(get_screener, get_token, get_chain_tip, get_ada_price) to find one native token
under \$0.005 with real liquidity for a 500 ADA position. Verify data freshness
with get_chain_tip. Always repeat the coverage field of every response — DEX data
covers SundaeSwap + WingRiders via DexScreener only, never total Cardano volume.
Write your recommendation with evidence to scout-report.md."
```

**Terminal B — Trader (execution):**

```sh
claude "You are TRADER, an execution agent. Read scout-report.md, challenge the
thesis (buy/sell ratio, freshness, position size vs liquidity), and use the
basilisk MCP tools to verify every claim independently. Check the treasury with
get_wallet. If the thesis holds, compose an UNSIGNED swap intent (pair, amount,
min-receive at 1% slippage) and write it to trade-intent.md. Do NOT sign or
submit anything — a human approves signing."
```

The file handoff (`scout-report.md` → `trade-intent.md`) is the negotiation channel. You can
also run both roles in a single session if you prefer; the phase structure is the point:

1. **Request** — Trader states the mandate.
2. **Negotiate** — Scout proposes with evidence; Trader challenges; Scout re-verifies.
3. **Transact** — Trader checks the wallet and emits an *unsigned* swap intent.
4. **Evaluate** — Scout re-reads the token and logs entry vs. current price.

## Honesty notes

- Execution intentionally stops at an **unsigned transaction**. Basilisk never holds keys;
  a human approves signing in their own wallet. Autonomous settlement is a research track,
  not a shipped feature.
- Every DEX aggregate carries `coverage: "SundaeSwap + WingRiders via DexScreener"`.
  That is DexScreener's Cardano coverage — it is not total Cardano volume or liquidity.
- ADA market data comes from CoinGecko; on-chain facts (balances, holders, chain tip)
  come from Koios.
