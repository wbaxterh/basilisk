# Scout × Trader — canonical Basilisk MCP session

> **Illustrative session · reproduce it yourself — the tools are live.**
> Values were realistic at the time of writing; live numbers change with the market.
> This transcript is the source of truth for the terminal shown on `/agents`.
> Runbook: see `README.md` in this directory.

Server: `basilisk` v0.2.0 · transport: streamable HTTP · endpoint: `/api/mcp`

---

## Phase 1 · REQUEST

**TRADER:** Need one CNT candidate under $0.005 with real liquidity for a 500 ADA rotation.
Justify it with live data.

**SCOUT ▸** `get_screener({ sort: "volume", limit: 10 })`
→ 24 tokens · coverage: `"SundaeSwap + WingRiders via DexScreener"` · top by 24h vol:
SNEK $412.8K, HOSKY $88.1K, WMTX $61.4K …

**SCOUT ▸** `get_token({ asset: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b" })`
→ SNEK · $0.00315 · +4.2% 24h · liquidity $2.41M across 6 pairs · buys 1,842 / sells 1,506 ·
holders ≈ 41,400

## Phase 2 · NEGOTIATE

**SCOUT:** Proposing SNEK. A 500 ADA clip is under 0.02% of pooled liquidity on the covered
DEXes — negligible impact. Buy/sell ratio 1.22 over 24h.

**TRADER:** How fresh is that read, and what is 500 ADA in USD right now?

**SCOUT ▸** `get_chain_tip()`
→ block 13,644,102 · epoch 641 · block_time 34s ago · coverage: Koios (Cardano mainnet)

**SCOUT ▸** `get_ada_price()`
→ ADA $0.8700 · +1.9% 24h · coverage: CoinGecko (CEX + DEX)

**SCOUT:** Chain tip is 34 seconds old — data is current. 500 ADA ≈ $435 → target fill
≈ 138,000 SNEK at $0.00315.

## Phase 3 · TRANSACT

**TRADER ▸** `get_wallet({ address: "$fund-ops" })`
→ stake1u9x…q4lz · 12,480 ADA · rewards 41.2 ADA · 17 holdings · total ≈ $11,930

**TRADER:** Balance confirmed. Composing swap intent: 500 ADA → min 136,600 SNEK
(1% slippage) on the deepest SundaeSwap pair. Emitting **UNSIGNED** transaction for approval.

> **Human in the loop:** execution stops here by design — the intent is an unsigned
> transaction. A human approves signing in their own wallet. Basilisk never holds keys.

## Phase 4 · EVALUATE

**SCOUT ▸** `get_token({ asset: "279c909f…534e454b" })`
→ SNEK · $0.00317 · liquidity $2.41M · re-check scheduled vs entry $0.00315

**SCOUT:** Logged: entry thesis, coverage caveat (SundaeSwap + WingRiders only), and a
24h re-evaluation. Session complete.

---

Phase vocabulary — Request → Negotiate → Transact → Evaluate — follows the industry
agent-commerce-protocol framing. Every `▸` line is a real Basilisk MCP tool call.
