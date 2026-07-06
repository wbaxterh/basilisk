# Cardano Forum Post — Basilisk v0.2

Target: forum.cardano.org (Developers / Community Technical). Longer, technical, migration-focused. Solo-founder voice, every claim verifiable today.

---

**Title:** Basilisk — a free, open-source successor to the TapTools API (live screener, wallet lookup, public REST API, and a hosted MCP server for agents)

Hi everyone,

When TapTools shut down in June, Cardano lost its de-facto market data API. taptools.io is a farewell page now. Their API powered integrations at teams like jpg.store, DexHunter, Vespr, and CSWAP, and it never had a free tier — plans ran $9–199/mo. That's a real vacuum for anyone building on Cardano data.

I've spent the last month building a successor. It's called **Basilisk**, it's open source, and as of today it's live:

- **App:** https://basilisk-seven.vercel.app (screener, token pages, wallet lookup — no signup)
- **Docs:** https://basilisk-docs.vercel.app
- **Source:** https://github.com/wbaxterh/basilisk

## What's live today

**Free public REST API** at `https://basilisk-seven.vercel.app/api/v1` — no API key, no signup:

| Endpoint | What it returns |
| --- | --- |
| `GET /api/v1` | Self-describing index |
| `GET /api/v1/tokens` | Screener: curated CNTs with live price, volume, liquidity, txns |
| `GET /api/v1/tokens/{policyId+assetNameHex}` | Token detail: per-DEX pairs, supply, decimals, fingerprint, estimated holders |
| `GET /api/v1/search?q=` | Token search by ticker/name |
| `GET /api/v1/wallet/{addr\|stake\|$handle}` | ADA balance, rewards, pool, holdings with USD values |
| `GET /api/v1/market` | ADA snapshot + price series (+ optional ecosystem list) |

**Hosted MCP server** at `https://basilisk-seven.vercel.app/api/mcp` (streamable HTTP) — to my knowledge the first hosted MCP server for Cardano market data. Six read-only tools: `get_screener`, `search_tokens`, `get_token`, `get_wallet`, `get_ada_price`, `get_chain_tip`. Connecting Claude takes one line:

```
claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp
```

Claude Desktop and Cursor setups are in the docs.

## Coverage — the honest part

I want to be very upfront about this, because market data credibility dies the first time someone catches you inflating numbers:

- **DEX aggregates come from DexScreener, which indexes only SundaeSwap + WingRiders on Cardano.** No Minswap. Prices, volume, and liquidity are aggregates over that coverage, and every API/MCP response carries a `coverage` field saying exactly that. The app shows a coverage chip wherever DEX aggregates appear. Nothing is ever labeled "total Cardano volume/liquidity".
- **On-chain and wallet data come from Koios** (public tier). Holder counts are Koios estimates.
- **ADA market data comes from CoinGecko** — a different pricing universe from the DEX figures, and the docs say not to mix them.
- **$handle resolution via handle.me**, with an on-chain Koios fallback.

The whole Phase-0 stack is composed free community APIs with heavy caching — which is how it runs at roughly $0/mo and why the API can be free. The architecture decisions (including why our own Kupmios ingestion is deferred, not abandoned) are written up as ADRs in the repo.

## Migrating from the TapTools API

Short version of the mapping (full guide: https://basilisk-docs.vercel.app/docs/api/taptools-migration):

| TapTools category | Basilisk | Status |
| --- | --- | --- |
| Token prices / quotes | `/api/v1/tokens`, `/api/v1/tokens/{asset}` | Live |
| Market cap / supply | `/api/v1/tokens/{asset}` | Live |
| Top tokens | `/api/v1/tokens` | Live |
| Holders | `/api/v1/tokens/{asset}` (estimate) | Live |
| Wallet positions | `/api/v1/wallet/{address}` | Live |
| Market stats | `/api/v1/market` | Live (ADA-level) |
| OHLCV candles | own chain ingestion planned | Roadmap |
| Trades feed | in development | Roadmap |
| NFT analytics | not built | Roadmap (research) |

Yes, the gaps are real: no candles, no per-swap trades, no NFT analytics yet. I'd rather list them here than have you find out in production.

## On the agent side (labeled honestly)

- **Live:** the MCP server and free API above.
- **In development:** x402 pay-per-query. x402 is the emerging open standard for agent payments, governed by the x402 Foundation under the Linux Foundation (Coinbase, Cloudflare, AWS, and Google are members). On Cardano the settlement path is Masumi Network's community x402-cardano facilitator, currently at the **testnet PoC** stage with USDM/ADA. I will not claim Cardano is on Coinbase's facilitator list (it isn't) or that autonomous mainnet trading exists (it doesn't).
- **Research:** a replayable Scout × Trader agent demo (Request → Negotiate → Transact → Evaluate) in `scripts/agent-demo/` — live market data, and the loop stops at an unsigned transaction intent: no funds move, real or simulated. Settlement via x402/Masumi is in development.

## What I'm asking

I'm a solo founder and this is shaped by what people actually need. If you integrated TapTools, or you're building anything on Cardano data:

1. Hit the API or plug in the MCP server and tell me what breaks.
2. Tell me which gap hurts most (candles? trades? NFT data?) — that ordering decides the roadmap: https://github.com/wbaxterh/basilisk/issues

Thanks for reading — happy to answer any technical questions in the thread.

Wes
