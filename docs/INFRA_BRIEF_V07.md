# Basilisk — Infrastructure & Scale-Up Brief

**Milestone:** v0.7 shipped 2026-07-16 · **Author:** Claude (session brief for Wes Huber) · **Status:** Decision inputs, no spend committed

---

## 1. Where we stand

Basilisk runs a real product on **$0/month infrastructure**: Vercel free tier (web + docs), Neon free Postgres (waitlist, boosts, comments, chat quotas), and four free upstream data planes (DexScreener, GeckoTerminal, Koios, DefiLlama, plus CoinGecko and handle.me). Live today: screener, token pages with DexHunter-class charts and drawing tools, wallet portfolio, community boosts/discussion, in-app trading (DexHunter widget), the `/defi` PRIME scoreboard, a free public REST API, the hosted MCP server, and Ask Basilisk (keyless, pending one env var).

The backlog tells one story: **of the 25 open feature issues, 20 chain to just four infrastructure decisions.** This brief lays out those decisions, the operational switches that need no engineering, costs, and a recommended order.

## 2. The four infrastructure decisions

### 2.1 DEX indexer — the big one (#85)

**Gates 13 issues:** ingestion family (#2 #3 #4 #5 #7), trades feeds (#19 #27), smart money (#26 #28), P&L + trade history (#14 #15), holder distribution (#29), value-over-time (#13). Also unlocks: sub-minute live candles (DexHunter's last remaining chart advantage), cross-DEX aggregated candles, wallet-trade overlays (TapTools' signature feature), and independence from DexScreener/GeckoTerminal coverage gaps (we already lost 10 registry tokens to silent DexScreener drift once).

| Option | Cost | Notes |
|---|---|---|
| Self-host Ogmios + Kupo on Hetzner/k3s, index top-5 DEX pool scripts | ~$50–100/mo | Full control; the original repo services (ingestion/pricing, ~1,900 LOC) are scaffolded for exactly this. Highest effort. |
| Demeter.run managed Ogmios/Kupo | ~$20–40/mo+ | Fastest start; usage pricing at scale. |
| DexHunter partner charts API | Unknown; partner terms | They sell exactly this (their charts run on it). Bridge option; pairs with the widget partnership. |

**Adjacent, free, time-sensitive:** apply for the **TradingView Advanced Charts license** (free but weeks of lead time) — the indexer's OHLCV becomes a TV datafeed later with no server changes.

### 2.2 Accounts & auth (#9)

**Gates:** the entire alerts family (#31 #32 #33), smart-money follows (#26), cross-device watchlists, saved multi-wallet portfolios, API keys (#35). Wallet-signature auth (CIP-8) already works for boosts/comments — accounts add persistence + email identity. Options: NextAuth + Neon (cheapest, ~0 incremental cost) or Clerk (faster, free tier then ~$25/mo). Sign-in-with-wallet is already 80% built via the community-layer signature verification.

### 2.3 Notifications delivery (#31)

Email is nearly free (Resend already integrated for the waitlist). Telegram/Discord bots need a long-lived worker or cron: Vercel cron (free, minute-granularity) covers price alerts at MVP; a $5/mo worker (Railway/Fly) covers real-time delivery later. Decision: MVP on Vercel cron once auth exists.

### 2.4 API monetization plane (#10, #35)

The free `/api/v1` is a growth asset; Pro/agent revenue needs metering: API keys, tiers, rate limits, x402 pay-per-query (the roadmap promise on /agents). The Fastify gateway (~1,350 LOC, never hosted) exists; alternative is keeping Next routes + Vercel KV/Upstash for shared quota state (~$0–10/mo). x402: Masumi's Cardano facilitator remains testnet — revisit quarterly.

## 3. Operational switches (no engineering, do these first)

| Switch | Impact | Cost |
|---|---|---|
| **ANTHROPIC_API_KEY in Vercel** | Ask Basilisk is deployed but dark in prod — the flagship AI feature currently shows a warming banner to every visitor | Metered API usage; bounded by 20 msg/day/IP quota, 1K-token replies |
| **DexHunter partner code** (`NEXT_PUBLIC_DEXHUNTER_PARTNER`) | Referral fees on swaps through our embedded widget — first revenue switch | Free |
| COINGECKO_DEMO_KEY | 10K calls/mo headroom vs shared keyless throttle | Free |
| Koios free JWT | 5kb POST bodies, higher rate ceiling for portfolio bulk lookups | Free |
| Custom domain (basilisk.io or similar) | Brand + SEO + credibility before launch push; both Vercel projects ready | ~$10–40/yr |
| Vercel WAF rate rule on `/api/*` | Abuse cap for the public API + chat (fan-out protection noted in the v0.3 security review) | Free tier |
| Sentry (free tier) or Vercel Analytics | Zero error observability today (#39) — we find prod bugs by using the site | Free tier |
| Upstash/Vercel KV for shared cache | GT's ~10 req/min budget is per-instance in-memory today; KV makes caches survive cold starts under launch traffic | Free tier → ~$10/mo |

## 4. Risk register

- **Free-API dependency:** DexScreener coverage drifted once already (10/30 registry tokens died silently — caught by the v0.5 probe). Mitigation shipped: registry regen procedure; recommended: weekly CI drift check. The indexer is the structural fix.
- **GeckoTerminal ceiling:** ~10 req/min shared across serverless instances; fine today, will strain at launch-spike traffic without KV-backed caching (§3).
- **Neon free tier:** community + quota tables are tiny, but boosts/comments growth and chat quotas share one database — monitor storage/connection limits post-launch.
- **Single point of judgment:** all deploys gate through one maintainer; observability gap (#39) means silent prod regressions are possible between manual audits (this brief's UX audit found three mobile blockers that shipped unnoticed in v0.5/v0.6).
- **PRIME dependency (none by design):** the /defi scoreboard is valuable regardless of the vote; grant/AC opportunities are upside only. Track the vote — status is hardcoded and needs a one-line update on enactment/failure.

## 5. Recommended sequence

1. **This week ($0):** flip the operational switches — ANTHROPIC_API_KEY, DexHunter partner code, CoinGecko key, Koios JWT, Sentry free, WAF rule. Apply for the TradingView license. Buy the domain.
2. **Next (≤$10/mo):** Upstash KV shared cache; weekly registry drift check in CI; NextAuth + Neon accounts (unlocks alerts MVP on Vercel cron + Resend).
3. **The decision (~$50–100/mo):** commission the DEX indexer (Hetzner self-host per the original scaffolds, or Demeter to start) — it collapses 13 backlog issues, completes chart superiority over DexHunter, and removes the free-API coverage risk. If PRIME passes, this is precisely the "analytics and data infrastructure" public-good grant shape (Phase 2 window, $2.6M ungated envelope).
4. **Later:** API keys/tiers + x402 metering once agent/API traffic justifies it; notifications worker when alert volume outgrows cron.

## 6. Scoreboard after v0.7

- **Shipped versions:** v0.2 → v0.7 in ten days; 8 ADRs; 96 PRs/issues processed; 12 legacy epics closed as delivered this milestone.
- **Open:** 25 issues, of which 20 blocked on §2 decisions, 3 independent (screener numeric filters #23, security pass #41, QA/load #40), 2 community-scoped (#72 news, #95 portfolio v2).
- **Production quality:** LCP 224–384ms, CLS ≤0.017, WCAG-AA text contrast, every page 390px-clean, zero console errors.
