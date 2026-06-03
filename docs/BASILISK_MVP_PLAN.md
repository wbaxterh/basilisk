# Basilisk — MVP Implementation Plan

**Owner:** Wes Huber · **Role of this doc:** Tech-lead implementation plan, user-story backlog, and infrastructure cost model for the Basilisk MVP.
**Status:** Draft v0.1 · June 2026 · Confidential
**Companion doc:** [`src/basilisk-prd.html`](src/basilisk-prd.html) → [`output/basilisk-prd.pdf`](output/basilisk-prd.pdf) (the product PRD this plan executes)

---

## 1. What "MVP" means here

The PRD defines four phases. **This plan covers MVP = Phase 0 (Foundations) + Phase 1 (MVP Web)** — roughly **Months 0–5** of the roadmap. The goal is a usable web product at rough feature parity with TapTools' *core* analytics + portfolio surfaces, plus a public Data API beta.

**In scope for MVP**

| # | Surface | Source PRD ref |
|---|---------|----------------|
| A | Portfolio Tracker (multi-wallet, ADA/USD, value-over-time, holdings, P&L) | §5.1 A |
| B | Token Charts (candles, OHLCV, live price, trades feed, token info) | §5.1 B |
| C | Market Screeners (top tokens, gainers/losers, trending, new) | §5.1 C |
| D | Wallet Profiler / Smart Money (any-address deep-dive, follow, whale feed) | §5.1 D |
| E | Token Distribution (top holders, concentration) | §5.1 E |
| F | Alerts (price / % move / whale / balance, multi-channel) | §5.1 F |
| G | Public Data API **beta** (REST, keys, free tier) | §5.1 G |
| — | The data engine under all of it: chain ingestion + DEX adapters + pricing engine | §7 |

**Explicitly deferred to Phase 2+ (NOT MVP):** in-app swaps, WebSocket streaming API, full DeFi dashboard, NFT analytics suite, mobile apps, embeddable widgets, x402 agent API, MCP server, A2A rails. (These are the *differentiators* — they come once the core is proven.)

**MVP success bar:** a trader can connect/watch a wallet, see correct net worth + P&L, open any token and see a correct live price + chart + recent trades, screen the market, look up any wallet, set an alert that fires, and a developer can pull token/market/wallet data from a documented REST API with a free key.

---

## 2. Assumptions & team

- **Team assumed:** 2–4 engineers. Realistic lean split: 1 backend/data (owns ingestion + pricing — the moat), 1 full-stack (API + portfolio/wallet services), 1 frontend (web app), + fractional design/PM (Wes). Estimates below assume ~3 FTE.
- **Estimates** are in **story points** (Fibonacci, 1 pt ≈ ½ day of one engineer including test + review). They are *planning* numbers, not commitments.
- **Stack** (from PRD §7.4): Next.js (web) · NestJS/TypeScript + Go for perf-critical ingestion · Postgres + TimescaleDB + Redis · Cardano data via **Demeter.run** (see §6) · TradingView lightweight-charts.
- **Data strategy decision (see §6):** start **managed** (Demeter + Blockfrost free fallback) rather than self-hosting a node. This removes ~1–3 weeks of db-sync ops from the critical path.

---

## 3. Epic map & milestones

```
M0  Foundations      ──► EPIC-0 Data Infra · EPIC-1 Platform/Auth · EPIC-9 DevOps
M1  Pricing + Charts  ──► EPIC-0 (DEX adapters, pricing) · EPIC-3 Token Charts
M2  Portfolio         ──► EPIC-2 Portfolio Tracker · EPIC-1 Wallet connect
M3  Discovery         ──► EPIC-4 Screeners · EPIC-5 Wallet Profiler/Smart Money · EPIC-6 Distribution
M4  Alerts + API      ──► EPIC-7 Alerts · EPIC-8 Public Data API beta
M5  Harden + launch   ──► perf, QA, docs, beta onboarding, observability polish
```

| Epic | Title | Pts (est) |
|------|-------|-----------|
| EPIC-0 | Data Infrastructure: ingestion, DEX adapters, pricing engine | ~110 |
| EPIC-1 | Platform: auth, wallet connect, API gateway/BFF | ~45 |
| EPIC-2 | Portfolio Tracker | ~55 |
| EPIC-3 | Token Charts | ~45 |
| EPIC-4 | Market Screeners | ~30 |
| EPIC-5 | Wallet Profiler / Smart Money | ~40 |
| EPIC-6 | Token Distribution | ~20 |
| EPIC-7 | Alerts | ~40 |
| EPIC-8 | Public Data API (beta) | ~35 |
| EPIC-9 | Web shell, design system, DevOps, observability | ~50 |
| | **Total** | **~470 pts** |

At ~3 FTE and a sustainable velocity, **~5 months is realistic** for this scope — consistent with the PRD's Month 0–5 MVP window. EPIC-0 is the long pole and the project's primary risk; everything else depends on it.

---

## 4. Epics → User Stories → Tasks

> Story IDs are `US-<epic>.<n>`. Each story carries **acceptance criteria (AC)** and **tasks (T)**. Priority: 🔴 must-have for MVP · 🟡 should-have · 🟢 nice-to-have.

### EPIC-0 — Data Infrastructure (the moat) 🔴

> Without correct, fresh prices nothing else matters. This epic is the critical path.

**US-0.1 — Connect to Cardano chain data** 🔴 (8 pts)
*As the platform, I need reliable access to live + historical Cardano chain data so that all downstream services have a source of truth.*
- **AC:** Services can read the chain tip, stream new blocks/txs, and query historical data; failover path exists if the primary provider degrades.
- T: Provision **Demeter.run** project; stand up **Ogmios** (chain-sync/WS) + **Kupo** (UTxO/address index) + **db-sync** (scale-to-zero, for historical SQL) ports.
- T: Wire **Blockfrost free tier (50k req/day)** as a drop-in REST fallback/cross-check.
- T: Build a thin internal `chain-data` client lib wrapping both, with health checks + circuit breaker.
- T: Define which addresses/policies Kupo indexes (DEX pool scripts + on-demand wallets).

**US-0.2 — Ingest the chain into our pipeline** 🔴 (13 pts)
*As the data layer, I want to tail new blocks and persist relevant events so we have a real-time + queryable event stream.*
- **AC:** New on-chain DEX swaps appear in our event store within the <5s freshness target; pipeline survives node restarts and resumes from last point.
- T: Ogmios/Oura chain-follower service (Go or TS) → normalized event stream → Redis pub/sub.
- T: Idempotent checkpointing (resume from last slot) + rollback handling (Cardano chain rollbacks).
- T: Persist raw swap/pool events to TimescaleDB.

**US-0.3 — DEX adapters (decode pools & swaps)** 🔴 (34 pts — split per DEX)
*As the pricing engine, I need each DEX's pools and swaps decoded into reserves + trade events so I can derive price and liquidity.*
- **AC:** For each supported DEX, pool reserves and individual swaps are reconstructed accurately and validated against the DEX's own UI for a sample of tokens.
- T: Adapter framework + shared interface (`getPools`, `decodeSwap`, `getReserves`).
- T: **Minswap** adapter (highest volume — do first).
- T: **SundaeSwap** adapter.
- T: **WingRiders** adapter.
- T: **MuesliSwap** adapter.
- T: **VyFinance** adapter.
- T: Evaluate **Charli3 Dendrite** (open-source SDK that already unifies Minswap/Sundae/WingRiders/Muesli/VyFi/Spectrum/GeniusYield) to accelerate or replace hand-rolled adapters. *Decision spike — could cut this story substantially.*
- T: Per-adapter conformance test suite + golden fixtures; alarm on decode failures (protocols upgrade scripts).

**US-0.4 — Pricing engine: VWAP + OHLCV** 🔴 (21 pts)
*As a user, I want an accurate, single price per token so charts, portfolio, and screeners all agree.*
- **AC:** Token price = volume-weighted across all pools, ADA-based, converted to USD via oracle; OHLCV candles built for 1m/5m/15m/1h/4h/1d; values match a manual spot-check within tolerance.
- T: VWAP aggregation across pools (ADA base).
- T: **ADA/USD oracle** integration (pick source; cross-check ≥2).
- T: OHLCV candle builder → persist to TimescaleDB (continuous aggregates).
- T: Backfill historical candles for top N tokens (via db-sync historical query).
- T: Live candle updates pushed to Redis pub/sub for chart/portfolio consumers.

**US-0.5 — Quality / spam filter** 🔴 (8 pts)
*As a user, I don't want to see scam/dust tokens polluting screeners and prices.*
- **AC:** Tokens below configurable liquidity/volume thresholds are flagged "low quality" and excluded from default lists (matching TapTools' threshold philosophy).
- T: Configurable thresholds (min liquidity, min volume, token age); outlier/anomaly handling for thin pools.
- T: Quarantine list + admin override.

**US-0.6 — Token metadata service** 🔴 (8 pts)
*As a user, I want token names, tickers, logos, decimals, supply, and policy IDs.*
- **AC:** Each token resolves to standard metadata (CIP-25/CIP-68 + off-chain registry); missing metadata degrades gracefully.
- T: Resolve from Cardano token registry + on-chain metadata; cache in Postgres; supply/FDV/mcap computation.

**US-0.7 — Reorg / data-correctness safeguards** 🔴 (10 pts)
- T: Rollback-aware writes; reconciliation job that cross-checks our prices vs Blockfrost/known sources; data-freshness SLA monitor (p95 latency dashboard); alerting on staleness.

---

### EPIC-1 — Platform: Auth, Wallet Connect, API Gateway 🔴

**US-1.1 — CIP-30 wallet connect (read-only)** 🔴 (13 pts)
*As a user, I want to connect my Cardano wallet so the app can read my holdings.*
- **AC:** Connect Eternl, Lace, Nami, Vespr, Typhon via CIP-30; read-only (no signing at MVP); address(es) persisted to my account; disconnect works.
- T: CIP-30 connector abstraction + per-wallet handling; multi-address (account) support; watch-only address add (no wallet needed).

**US-1.2 — Account & auth (email/social + sign-in-with-wallet)** 🔴 (13 pts)
*As a user, I want to create an account so my wallets, watchlists, and alerts persist.*
- **AC:** Sign up via email/social *or* CIP-30 sign-in-with-wallet; sessions; password reset; GDPR-minimal data.
- T: Auth service (consider Supabase Auth to save build time); session/JWT; wallet-signature login (CIP-8/CIP-30 `signData`).

**US-1.3 — API Gateway / BFF** 🔴 (13 pts)
*As the system, I want one gateway handling auth, rate-limiting, caching, and API keys.*
- **AC:** All client + 3rd-party traffic flows through the gateway; per-tier rate limits enforced; response caching for hot endpoints; request metering recorded.
- T: Gateway service (NestJS) ; Redis-backed rate limiter; API-key issuance/validation; per-endpoint cache TTLs; usage metering → Postgres.

**US-1.4 — Watchlists** 🟡 (6 pts)
*As a user, I want to save tokens/wallets to a watchlist.*
- T: Watchlist CRUD; sync across devices.

---

### EPIC-2 — Portfolio Tracker 🔴

**US-2.1 — Net worth & holdings** 🔴 (13 pts)
*As a holder, I want my total net worth and a breakdown of holdings so I know what I own and what it's worth.*
- **AC:** Net worth in ADA + USD + chosen fiat; holdings across native tokens, NFTs, LP tokens (decoded to underlying), liquid-staking, lending positions; refreshes on demand and within freshness SLA.
- T: Portfolio service: resolve UTxOs → balances (via Kupo); decode LP tokens to underlying; mark-to-market via pricing engine; multi-wallet aggregation; fiat conversion.

**US-2.2 — Value-over-time chart** 🔴 (10 pts)
*As a holder, I want a chart of my portfolio value over time.*
- **AC:** Historical net-worth series (daily granularity at MVP); handles wallets added later (backfill).
- T: Snapshot job (daily portfolio valuation) + historical reconstruction from trade history; chart endpoint.

**US-2.3 — Realized / unrealized P&L** 🔴 (13 pts)
*As a trader, I want P&L per position so I know if I'm up or down.*
- **AC:** Per-token realized + unrealized P&L from reconstructed trade history; cost-basis method documented (e.g. avg cost).
- T: Trade reconstruction from on-chain swap history per wallet; cost-basis engine; edge cases (airdrops, LP, transfers in/out).

**US-2.4 — Trade history** 🟡 (8 pts)
- T: Per-wallet chronological trade list with token, side, price, value, tx link.

**US-2.5 — Portfolio UI** 🔴 (11 pts)
- T: Portfolio dashboard page; holdings table; allocation breakdown; value chart; P&L; empty/watch-only states.

---

### EPIC-3 — Token Charts 🔴

**US-3.1 — Candlestick chart + OHLCV** 🔴 (13 pts)
*As a trader, I want a fast candlestick chart with multiple timeframes.*
- **AC:** TradingView lightweight-charts; 1m→1d timeframes; loads sub-second from cached candles; live last-candle updates.
- T: Chart component; OHLCV endpoint (TimescaleDB continuous aggregates); live update via Redis subscription.

**US-3.2 — Live price + token info panel** 🔴 (8 pts)
*As a user, I want the current price and key token facts in one place.*
- **AC:** Live VWAP price; supply, mcap, FDV, liquidity, holder count, links, policy ID; price-change %, ATH/ATL.
- T: Token detail endpoint aggregating pricing + metadata + distribution; info panel UI.

**US-3.3 — Recent trades feed** 🔴 (8 pts)
*As a trader, I want to see the latest trades for a token.*
- **AC:** Last ~500 trades (buy/sell, size, price, time, wallet) updating live.
- T: Trades endpoint + live feed UI; whale-trade highlighting.

**US-3.4 — Token page shell** 🔴 (8 pts)
- T: `/token/[id]` route; chart + info + trades + distribution tabs; share/deeplink; SEO basics.

**US-3.5 — Chart drawing tools / indicators** 🟢 (8 pts — defer if tight)
- T: Basic indicators (MA, volume) ; drawing tools (post-MVP candidate).

---

### EPIC-4 — Market Screeners 🔴

**US-4.1 — Top tokens & movers** 🔴 (13 pts)
*As a trader, I want ranked lists (top by mcap/volume, gainers, losers, trending, new) so I can find opportunities.*
- **AC:** Top tokens by mcap/volume; gainers/losers; trending; new listings; quality thresholds applied; sortable/paginated; refreshes within SLA.
- T: Screener query layer over TimescaleDB; ranking jobs; "new listing" detection; trending heuristic.

**US-4.2 — Filters** 🟡 (8 pts)
- T: Filter by liquidity, volume, age, category; saved filters.

**US-4.3 — Screener UI** 🔴 (9 pts)
- T: Screener tables; tabs; sparklines; responsive.

---

### EPIC-5 — Wallet Profiler / Smart Money 🔴

**US-5.1 — Any-address profiler** 🔴 (13 pts)
*As a user, I want to look up any wallet's total/liquid value, holdings, volume, activity, and P&L.*
- **AC:** Given any address/handle, show net worth, holdings, trade volume, activity pattern, P&L; reuses portfolio engine read-only.
- T: Profiler endpoint (generalize portfolio service to arbitrary address); ADA Handle resolution; UI.

**US-5.2 — Smart-money lists & follow** 🔴 (13 pts)
*As a trader, I want curated lists of profitable/high-activity wallets and to follow them.*
- **AC:** Curated "smart money" lists (by realized PnL / volume / activity); follow a wallet; per-wallet activity feed.
- T: Wallet-scoring job (PnL/volume leaderboards); follow model; clustering/labeling (basic at MVP).

**US-5.3 — Whale-trade feed** 🟡 (8 pts)
*As a trader, I want a live feed of large trades.*
- T: Threshold-based whale-trade detection from swap stream → feed + (later) alert source.

**US-5.4 — Profiler/smart-money UI** 🔴 (6 pts)
- T: Wallet page; smart-money dashboard; follow buttons.

---

### EPIC-6 — Token Distribution 🔴

**US-6.1 — Holder distribution** 🔴 (13 pts)
*As a due-diligence user, I want to see holder concentration and top holders.*
- **AC:** Top holders, top-10 %, Gini/concentration, LP-vs-wallet split, supply distribution; excludes burn/known contract addresses.
- T: Holder enumeration per policy/asset (via Kupo/db-sync); concentration metrics; known-address labeling; UI on token page.

---

### EPIC-7 — Alerts 🔴

**US-7.1 — Alert rules engine** 🔴 (13 pts)
*As a user, I want to create alerts on price thresholds, % moves, whale trades, and balance changes.*
- **AC:** Create/edit/delete alert rules; rules evaluated against the live stream; fire once / repeat options; per-user limits by tier.
- T: Rule model + evaluation service consuming Redis pub/sub; dedupe/cooldown; persistence.

**US-7.2 — Multi-channel delivery** 🔴 (13 pts)
*As a user, I want alerts via in-app, push, email, and Telegram/Discord.*
- **AC:** Delivery to in-app inbox, web push, email, and Telegram/Discord webhook; retry on failure; user channel prefs.
- T: Notification service; email (Resend/SES); web push; Telegram + Discord bot integrations; delivery log + retries.

**US-7.3 — Alerts UI** 🔴 (8 pts)
- T: Alert creation flows from token/wallet pages; alert management page; in-app notification center.

**US-7.4 — New LP / new listing alerts** 🟡 (6 pts)
- T: Detect new pools/listings → alertable event.

---

### EPIC-8 — Public Data API (beta) 🔴

**US-8.1 — REST endpoints (parity surface)** 🔴 (13 pts)
*As a developer, I want REST endpoints for token, NFT(min), market, and wallet data.*
- **AC:** Endpoints mirroring PRD §2.3 (token price/OHLCV/trades/holders; market stats; wallet portfolio/holdings/history); stable, versioned (`/v1`), consistent schemas.
- T: Public API module over existing services; pagination; error contract; `/v1` versioning.

**US-8.2 — API keys, tiers & rate limits** 🔴 (10 pts)
*As a developer, I want a free key with clear rate limits.*
- **AC:** Self-serve key issuance; free tier (rate-limited) + paid tier placeholders; usage dashboard; per-key metering.
- T: Key management UI; tier config; metering surfaced to user; quota enforcement at gateway.

**US-8.3 — Docs, SDK stub & sandbox** 🔴 (12 pts)
*As a developer, I want great docs so I can integrate fast.*
- **AC:** OpenAPI spec; interactive docs; quickstart; at least a TS client stub; example calls (e.g. "top holders for SNEK").
- T: OpenAPI generation; docs site (Scalar/Redoc); TS SDK stub; copy-paste examples.

---

### EPIC-9 — Web Shell, Design System, DevOps & Observability 🔴

**US-9.1 — App shell & design system** 🔴 (13 pts)
- T: Next.js app shell; navigation; theming (the PRD's Cardano-blue / serpent-green brand); component library; light/dark; responsive; loading/empty/error states.

**US-9.2 — CI/CD & environments** 🔴 (10 pts)
- T: GitHub Actions (lint/test/build/deploy); dev/staging/prod envs; preview deploys (Vercel); secrets management (no secrets in repo — env/secret store); IaC for backend (Hetzner + k3s or chosen PaaS).

**US-9.3 — Observability & error tracking** 🔴 (10 pts)
- T: Grafana Cloud (metrics/logs) + Sentry (errors); data-freshness SLA dashboard; uptime/alerting; structured logging across services.

**US-9.4 — QA, load test & beta onboarding** 🔴 (10 pts)
- T: E2E tests (Playwright) for core flows; load test pricing/API; beta waitlist + onboarding; feedback loop.

**US-9.5 — Security & privacy pass** 🔴 (7 pts)
- T: Authz review; rate-limit abuse tests; PII minimization; dependency scan; secrets audit before any public launch.

---

## 5. Cross-cutting Definition of Done

A story is **done** when: code reviewed + merged · unit/integration tests pass · meets AC · instrumented (logs/metrics) · no secrets in code · docs/changelog updated · deployed to staging and smoke-tested. **Data stories** additionally require a correctness cross-check against an external source (Blockfrost / the DEX's own UI).

---

## 6. Cardano data layer — decision & "Dedalus" clarification

> You asked me to "look into using Dedalus." Here's the finding up front:

**"Dedalus" is not a real Cardano data-infra product.** The name almost certainly refers to **Demeter.run** (by TxPipe) — the actual managed Cardano infrastructure PaaS (phonetically close: *De-meter ≈ De-dalus*). The only similarly-named real thing is **Daedalus** (IOG's desktop full-node *wallet*, daedaluswallet.io) — an end-user wallet, irrelevant to our data layer. **Recommendation: the intended product is Demeter, and it's a good fit. We should use it.**

### Options evaluated

| Provider | What it gives us | Pricing (June 2026) | Fit |
|----------|------------------|---------------------|-----|
| **Demeter.run** (TxPipe) ⭐ | Hosted **Ogmios, Kupo, Oura, db-sync, cardano-node** — the exact primitives we'd otherwise self-host. Scale-to-zero, pay-as-you-go. | Kupo ≈ **$0.09 / 100k req**; Ogmios ≈ **$0.23 / 100k req**; db-sync billed by connection-time, **$0 idle**. Grant-subsidized free tier. *(Live pricing page is JS-gated — confirm exact rates in-dashboard.)* | **Primary.** Gives us real-time (Ogmios/Oura) + UTxO index (Kupo) + historical SQL (db-sync) without hosting a 700 GB db-sync DB. |
| **Blockfrost** | Managed REST API (no streaming). | Free **50k req/day** forever; Hobby €29/mo (300k/day); Developer €79/mo (1M/day). | **Fallback / dev convenience.** Can't stream or aggregate OHLCV server-side, so not the primary. |
| **Koios** | Community decentralized REST API. | Free 50k/day (registered); Pro ~$30/mo (500k/day); Premium ~$75/mo (1.2M/day). | Secondary cross-check; community SLA. |
| **Maestro** (gomaestro.org) | Web3 stack incl. **dedicated DEX/market-price endpoints** — very on-topic. | Usage-based "compute credits"; has a free tier. **Exact USD pricing could not be verified (page JS-gated)** — confirm in dashboard. | Worth a spike — its DEX endpoints could shortcut some adapter work. |
| **Charli3 Dendrite** | Open-source SDK unifying DEX data (Minswap/Sundae/WingRiders/Muesli/VyFi/Spectrum/GeniusYield). *A library, not a host.* | Free (OSS). | **Use on top of Demeter to accelerate US-0.3 DEX adapters.** |
| **Self-host node + db-sync** | Full control, no per-req fees, full SQL. | Hetzner box (64 GB RAM, ~1 TB NVMe) **~$60–120/mo fixed**; AWS equivalent **~$350–550/mo**. Needs ~700 GB SSD, multi-day initial sync, ongoing ops. | **Phase 2+ / post-PMF.** Too much ops on the MVP critical path. |

### Recommended path (MVP)

**Demeter (Ogmios + Kupo + db-sync) as primary, Blockfrost free as fallback, Charli3 Dendrite to accelerate DEX parsing.**
- Real-time DEX prices → Ogmios/Oura chain tail + Dendrite-parsed pools.
- Historical OHLCV → db-sync scale-to-zero SQL.
- Wallet/portfolio UTxO resolution → Kupo.
- **Estimated Cardano-data cost at MVP scale (<10k calls/day): ~$20–40/month.**
- **Migration trigger:** once historical-aggregation load makes db-sync connection-time billing climb, or we need guaranteed real-time latency at scale → move node + db-sync in-house on Hetzner (~$60–120/mo fixed). Document this as the planned scale-up.

---

## 7. Infrastructure cost model (MVP)

> Cardano data layer (§6) is **~$20–40/mo** on top of the figures below. All prices June 2026; usage-billed items depend on real traffic. Hetzner excludes ~19% EU VAT.

### Monthly cost — two scenarios

| Category | Scrappy (Hetzner + self-managed) | Managed PaaS |
|----------|----------------------------------|--------------|
| **Cardano data (§6)** | $20–40 (Demeter + Blockfrost free) | $20–40 |
| Web hosting | $0 (self-host on VM) | $20 (Vercel Pro) |
| Backend compute (4–6 svcs) | $25 (2× Hetzner + k3s) | $40 (Railway/Fly) |
| Postgres | $0 (on VM) or $15 (DO managed) | $25 (Supabase Pro) |
| Time-series DB (OHLCV) | $0 (self-host Timescale on VM) | $30 (Timescale Cloud) |
| Redis (cache + pub/sub) | $0 (on VM) or $10 (Upstash) | $10 (Upstash) |
| Monitoring + error tracking | $0 (Grafana Free + Sentry Free) | $26 (Sentry Team) |
| Notifications (email/push/TG) | ~$2 (SES) + free channels | $20 (Resend Pro) |
| Object storage (Cloudflare R2) | $0–5 | $5 |
| CDN (Cloudflare) | $0 | $0 |
| Domain | ~$0.67 | ~$0.67 |
| CI/CD (GitHub Actions) | $0 (free tier) | $4 |
| **Subtotal (ex-data)** | **~$25–60** | **~$180** |
| **TOTAL incl. Cardano data** | **≈ $50–100 / month** | **≈ $200–225 / month** |

**Pragmatic hybrid most teams land on** (Vercel + Hetzner compute + managed PG + self-host Timescale + Upstash + Sentry + Resend + Demeter): **≈ $150–180/month** all-in for the MVP.

### How it scales (directional)
- **Time-series DB is the steepest curve** — OHLCV + trades grow fast; budget it as the #1 scaling cost (self-host Timescale → Timescale Cloud $100s → ClickHouse if needed).
- **Compute** climbs next; moving to managed K8s adds ~$73/mo control plane *before* nodes — defer until scale demands it.
- **Keep storage/CDN on Cloudflare** (R2 zero-egress) to avoid the AWS egress trap.
- **Email** → migrate to SES at 100k+/mo.
- **Trajectory:** MVP **~$50–225/mo** → 10k users **~$500–1,500/mo** → 50k+ users w/ heavy time-series **$2,000–6,000+/mo**.

---

## 8. Key risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **DEX decoder maintenance** (protocols upgrade scripts) | Prices break silently | Conformance tests + golden fixtures + decode-failure alarms; lean on Charli3 Dendrite (community-maintained) |
| **Data accuracy on thin pools** | Wrong prices erode trust | Quality/outlier filters (US-0.5); cross-check vs Blockfrost (US-0.7) |
| **Demeter cost/latency surprises** | Budget or UX hit | Validate rates in-dashboard early; Blockfrost fallback; documented Hetzner self-host escape hatch |
| **EPIC-0 is the critical path** | Slips whole MVP | Start it Day 1; spike Charli3 Dendrite early to de-risk adapters; Minswap-first to get one DEX end-to-end fast |
| **Scope creep into Phase 2** (swaps, streaming, agents) | MVP never ships | Differentiators explicitly deferred (§1); hold the line |
| **Trade reconstruction / P&L correctness** | Misleading P&L | Document cost-basis method; reconcile against known wallets; treat edge cases explicitly |

---

## 9. Immediate next actions (first 2 weeks)

1. **Stand up Demeter** project (Ogmios + Kupo + db-sync) and confirm live pricing in-dashboard. *(US-0.1)*
2. **Spike Charli3 Dendrite** vs hand-rolled adapters — decide the DEX-adapter approach before committing 34 pts. *(US-0.3 spike)*
3. **Minswap end-to-end vertical slice:** ingest → decode → VWAP → one token's live price + candle on a bare page. Proves the whole pipeline early. *(US-0.2 → US-0.4)*
4. **Pick ADA/USD oracle** + provision Timescale/Postgres/Redis. *(US-0.4)*
5. **Scaffold app shell + CI/CD + Sentry/Grafana** so feature work lands in a real pipeline from the start. *(EPIC-9)*

---

*Basilisk MVP Plan · Draft v0.1 · June 2026 · Confidential. Pairs with the product PRD in [`output/basilisk-prd.pdf`](output/basilisk-prd.pdf).*
