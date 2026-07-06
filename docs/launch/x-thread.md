# X/Twitter Launch Thread — Basilisk v0.2

8 tweets. Solo-founder voice. Every claim verifiable today. Post as a thread; tweet 1 is the hook.

---

**1/8**

TapTools shut down last month and took Cardano's market data API with it. No free tier ever existed ($9-199/mo), and now even that is gone.

So I built the successor. It's free, it's live, and it's built for AI agents from day one.

Meet Basilisk. Thread:

---

**2/8**

Live today at basilisk-seven.vercel.app:

- Token screener with real DEX prices, volume, liquidity
- Token pages with per-DEX pairs, supply, holders
- Wallet lookup: addr1, stake1, or your $handle — full holdings with USD values

No signup. No wallet connect required. Just data.

---

**3/8**

Honesty first, because this space needs it:

DEX aggregates come from DexScreener, which covers SundaeSwap + WingRiders on Cardano. Not Minswap, not the whole chain — and the app says so on every page with a coverage chip.

I will never label it "total Cardano volume". Ever.

---

**4/8**

The part I'm most excited about: to my knowledge this is the first hosted MCP server for Cardano market data.

One line and Claude can query Cardano markets:

claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp

Works in Claude Desktop and Cursor too. No key.

---

**5/8**

Where this is going: agents paying agents.

There's a replayable Scout x Trader demo in the repo — Request, Negotiate, Transact, Evaluate — running against live market data. The loop stops at an unsigned transaction intent: no funds move, real or simulated. Settlement via x402/Masumi is in development. It's research, clearly labeled as research.

basilisk-seven.vercel.app/agents

---

**6/8**

If you were building on the TapTools API: the free public API is live.

GET basilisk-seven.vercel.app/api/v1 — tokens, search, wallets, market. No key required.

I wrote a migration guide mapping their endpoints to mine, including the honest gaps (no OHLCV candles or trades feed yet): basilisk-docs.vercel.app/docs/api/taptools-migration

---

**7/8**

The whole thing runs on community rails — DexScreener, Koios, CoinGecko, handle.me — composed carefully with caching, for roughly $0/mo of infra.

That's why it can be free. Open source, ADRs and all: github.com/wbaxterh/basilisk

Next up (in development, not live): x402 pay-per-query and a live trades feed.

---

**8/8**

I'm one person filling a hole TapTools left in the whole ecosystem, so:

- Try it: basilisk-seven.vercel.app
- Docs: basilisk-docs.vercel.app
- Tell me what's broken or missing: github.com/wbaxterh/basilisk/issues

If this is useful to you, an RT genuinely helps more than you'd think.
