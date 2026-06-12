# Basilisk

**Cardano analytics for humans and agents.**

*Public whitepaper · v0.1 · 2026*

---

## TL;DR

We're building the analytics platform Cardano deserves — and the one its next generation of traders will actually use.

Today that next generation is human. Tomorrow it's mostly autonomous AI agents. **Basilisk** is the first Cardano data platform built for both:

- **For humans** — A TapTools-grade workspace: real-time charts, portfolio P&L, smart-money tracking, whale flows, alerts. Transparent pricing. Open data API. Built by people who actually use this stuff to trade.
- **For agents** — A native [x402](https://www.x402.org) micropayment layer and an MCP server. AI agents pay per request in ADA, no accounts, no keys, no API contracts. The first analytics platform on any chain designed for autonomous use from day one.

We are not betting on agents replacing traders. We are betting on the analytics platform that serves both winning the next decade.

---

## 1. The Problem: Cardano deserves better

Cardano has a real, growing, on-chain economy. Billions of ADA in DEX volume. Hundreds of native tokens. A serious DeFi stack — Minswap, Indigo, Liqwid, Wingriders, Splash. Active developers, active liquidity, active traders.

It does not have a serious analytics platform.

**TapTools is what we have.** It is good. It is also closed-source, behind a paywall for the features that matter most, weak on developer access, and architecturally locked into a single team's roadmap. There's no public REST API worth using. There's no wallet-grade portfolio tracker that respects the privacy of an address. There's no story for agents at all.

**Other chains have moved on.**

- Ethereum traders have Dune, DefiLlama, Nansen, Etherscan, plus a dozen specialized tools.
- Solana traders have Birdeye, DexScreener, Jupiter terminal.
- Cardano traders have… TapTools and a tab full of DEX UIs.

That gap isn't a small UX complaint. It is *the* reason serious trading capital looks at Cardano, can't find the tooling, and goes elsewhere. Liquidity follows tooling.

**Closing that gap is half of what Basilisk is.**

---

## 2. What we are building (the human part)

Basilisk is a Cardano analytics workspace, free to use, with a transparent open API.

**Day-one surfaces:**

- **Live charts** — OHLCV candles, VWAP pricing, trade feeds across every major Cardano DEX. TradingView under the hood. Real-time, not delayed.
- **Portfolio tracking** — Connect a CIP-30 wallet or watch any address. Net worth, P&L, value-over-time, full holdings breakdown. Multi-wallet by default.
- **Market screener** — Top tokens, gainers, losers, trending, new pairs. Sortable, filterable, streaming.
- **Whale profiler** — Pick any wallet. See its trade history, biggest positions, recent moves. Build a watchlist of smart money.
- **Alerts** — Thresholds on price, % moves, whale activity, or balance changes. Routed to email, Telegram, Discord, or a webhook.
- **Open Data API** — REST + WebSocket. Free tier with generous limits. Every endpoint the UI uses is public.

**What's different from TapTools:**

| | TapTools | Basilisk |
| --- | --- | --- |
| Core analytics | Behind a paywall | Free, forever |
| API access | Limited, paid | Public, free tier |
| Open source | No | Yes — code is on GitHub |
| Designed for agents | No | Yes — x402 + MCP from day one |
| Wallet attribution | Email + Twitter | CIP-30 signature, on-chain proof |
| Pricing model | Subscription | Free + usage-based for power features |

---

## 3. The agent thesis (the half nobody else sees)

**The next wave of crypto trading volume is not going to be people clicking buttons.**

It's going to be agents — autonomous AI systems built on top of LLMs, executing strategies, rebalancing portfolios, hunting arbitrage, responding to on-chain events, and paying for the data they need to do all of it. This is not speculation. It is happening now on Ethereum and Solana via experimental rails. The standards just arrived.

The two that matter:

- **[x402](https://www.x402.org)** — A revived HTTP `402 Payment Required` status code, re-spec'd as a real settlement protocol. An agent makes a request, the server returns `402` with a price + payment receiver, the agent signs a microtransaction, retries with the receipt, gets the data. **No accounts. No API keys. No SaaS contracts.** Just signed payments per request.
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)** — Anthropic's open standard for letting any LLM invoke external tools through a uniform interface. Claude, GPT, open-source models — they all speak MCP. An MCP server exposes a tool surface; agents call it like any other function.

These two together change the analytics business model. Today, every market-data provider's pricing assumes a human signs up, gives a credit card, generates a key, and pastes it into one app. **Agents can't do that.** They cannot fill in a credit-card form. They cannot accept a click-wrap ToS. They cannot share a bearer token safely with other agents. The legacy model breaks at every step.

The platform that solves it for Cardano first owns the data layer for the next decade of trading on this chain.

**Basilisk is doing it first.**

- An MCP server exposing the same data primitives as the UI — prices, candles, tokens, wallets, screeners — as structured agent tools.
- An x402 endpoint family with per-request ADA pricing. Sign a payment, get the data. No accounts.
- An Agent-to-Agent (A2A) layer on top — agents discover each other, negotiate prices for derived signals, settle in ADA.

This isn't a "we'll add agent support later" pitch. **It's the architecture from line one.** The REST API and the agent rails share the same code path.

---

## 4. Why us, why now

**Why Cardano:** The chain has real liquidity, real users, and structurally underserved tooling. The gap is wide enough that a credible team can land hard and matter.

**Why now:** x402 was published in 2025. MCP was published in 2024. The first generation of agent-native infrastructure is being built right now, on Ethereum and Solana. Cardano has zero. The window to be the first agent-native analytics layer for this chain closes when someone else figures it out.

**Why us:** A small team that uses these tools to trade, ships fast, and writes everything in the open. The repo is public. The whitepaper is this document. The early-access cohort sees what we ship in real time.

---

## 5. What's live today

- **This landing page** at [basilisk-seven.vercel.app](https://basilisk-seven.vercel.app) with the waitlist.
- **This whitepaper** at [basilisk-seven.vercel.app/whitepaper](https://basilisk-seven.vercel.app/whitepaper).
- **Public docs** at [basilisk-docs.vercel.app](https://basilisk-docs.vercel.app) covering the REST API and agent integration.
- **The open-source monorepo** at [github.com/wbaxterh/basilisk](https://github.com/wbaxterh/basilisk).

Under the hood: chain ingestion (Kupmios + Ogmios), pricing engine, portfolio engine, DEX adapters, REST gateway. The data pipeline is working. The UI is next.

---

## 6. The roadmap

| Quarter | What ships |
| --- | --- |
| **Q3 2026** | Early-access invites · public dashboard alpha · core analytics (charts, portfolio, screener, whale profiler) |
| **Q4 2026** | Alerts engine · REST API beta keys · founding-member tier locked in |
| **Q1 2027** | **x402 + MCP closed alpha** with design partners |
| **Q2 2027** | x402 + MCP public beta · A2A discovery protocol · multi-agent strategies |
| **Q3 2027** | Mobile-first companion app · embeddable widgets · public launch |

This will change. We will tell you when it changes.

---

## 7. Joining the cohort

The waitlist is open. Two signals get you priority:

- **Email** — gets you in the queue.
- **CIP-30 wallet** — connects your Cardano wallet and bumps you to the front. Verified founding members.

Founding members get **lifetime free Pro tier**, **alpha access to x402 + MCP**, and a **direct channel to the founders**. These perks survive public launch.

[**Claim a spot →**](https://basilisk-seven.vercel.app/#waitlist)

---

## Appendix · Trust & technical depth

This whitepaper is the narrative. The engineering plan, ADRs, and source code are public for anyone who wants to verify the architecture before trusting it:

- **Engineering MVP plan** — `docs/BASILISK_MVP_PLAN.md` in the [repo](https://github.com/wbaxterh/basilisk).
- **Architecture decision records** — `docs/adr/` in the repo. Every load-bearing tech choice (Kupmios over Ogmios-only, failover providers, etc.) is recorded and explained there.
- **Public source** — [github.com/wbaxterh/basilisk](https://github.com/wbaxterh/basilisk). Issues and discussions are open.
