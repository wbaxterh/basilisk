# Reddit r/cardano Post — Basilisk v0.2

Community tone: lead with free + open, invite feedback, zero hype. Check subreddit self-promo rules / use the projects thread if required. Solo-founder voice.

---

**Title:** TapTools' API shut down, so I built a free open-source replacement — screener, wallet lookup, public API, and an MCP server so Claude can query Cardano markets

Hey r/cardano,

Like a lot of you I was bummed when TapTools shut down in June — their API was the backbone for a bunch of Cardano tools, and it never even had a free tier ($9–199/mo, now gone entirely).

I've been building a replacement solo and it went live today. It's called Basilisk, it's completely free, and the code is open source:

- **App:** https://basilisk-seven.vercel.app — token screener, token pages, wallet lookup (works with $handles). No signup, no wallet connect needed.
- **Free public API:** `https://basilisk-seven.vercel.app/api/v1` — no API key at all. Tokens, search, wallets, ADA market.
- **Docs:** https://basilisk-docs.vercel.app — including a migration guide for anyone who was on the TapTools API.
- **Code:** https://github.com/wbaxterh/basilisk

The thing I think is genuinely new: it ships with a hosted **MCP server**, so if you use Claude (or Cursor), you can connect it with one line and just ask questions like "what's moving on Cardano today?" or "what's in wallet $yourhandle?":

```
claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp
```

As far as I can tell it's the first hosted MCP server for Cardano market data.

**Being upfront about limitations** (I'd rather you hear it from me):

- DEX prices/volume/liquidity come from DexScreener, which only covers **SundaeSwap + WingRiders** on Cardano — no Minswap yet. The app shows a coverage label everywhere, and I don't pretend it's "total Cardano volume".
- No OHLCV candles or per-swap trade feed yet — those need our own chain indexer, which is planned but not built.
- Wallet/on-chain data comes from Koios, ADA market data from CoinGecko. It's free community infrastructure composed carefully, which is exactly why the API can be free.
- The "agents paying for data" stuff (x402 micropayments) is **in development on testnet**, not live. There's a fun replayable two-agent demo in the repo, but it stops at an unsigned transaction intent — no funds move, real or simulated, and I'm not going to claim otherwise.

I built this because the ecosystem shouldn't lose its data layer every time one company folds. It's one person's work so far, so feedback here genuinely shapes what gets built next — if you try it and something's broken, confusing, or missing, tell me (comments or GitHub issues both work).

Thanks for reading.
