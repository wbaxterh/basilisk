# 🐍 Basilisk

**Cardano on-chain analytics, portfolio & trading platform** — a TapTools competitor differentiated on real-time data, transparent pricing, an open developer API, and an agent-native (x402 / MCP) layer.

> **Status:** Pre-MVP. This monorepo is being scaffolded from the PRD and MVP plan. See [`docs/`](docs/).

## 📄 Planning documents

| Doc | Source | Rendered |
|-----|--------|----------|
| Product Requirements (PRD) | [`docs/src/basilisk-prd.html`](docs/src/basilisk-prd.html) | [`docs/output/basilisk-prd.pdf`](docs/output/basilisk-prd.pdf) |
| MVP Implementation Plan | [`docs/BASILISK_MVP_PLAN.md`](docs/BASILISK_MVP_PLAN.md) · [`docs/src/basilisk-mvp-plan.html`](docs/src/basilisk-mvp-plan.html) | [`docs/output/basilisk-mvp-plan.pdf`](docs/output/basilisk-mvp-plan.pdf) |

Rebuild the PDFs: `npm run docs:pdf` (or `npm run generate:plan --workspace docs`).

## 🗂 Monorepo layout

```
basilisk/
├── apps/
│   ├── web/              # Next.js web app (EPIC-9, EPIC-2/3/4/5/6/7 UIs)
│   └── api-gateway/      # API gateway / BFF — auth, rate-limit, caching, API keys (EPIC-1, EPIC-8)
├── services/
│   ├── ingestion/        # Chain follower: Ogmios/Oura → events (EPIC-0: US-0.1/0.2)
│   ├── pricing/          # DEX adapters + VWAP + OHLCV engine (EPIC-0: US-0.3/0.4/0.5/0.6)
│   ├── portfolio/        # UTxO → holdings, mark-to-market, P&L (EPIC-2, EPIC-5)
│   ├── alerts/           # Rules engine over the event stream (EPIC-7)
│   └── notifications/    # Multi-channel delivery: email/push/Telegram/Discord (EPIC-7)
├── packages/
│   ├── chain-data/       # Demeter + Blockfrost client lib w/ failover (US-0.1)
│   └── shared/           # Shared types, config, utils
├── docs/                 # PRD, MVP plan, branded-PDF generator
└── .github/workflows/    # CI
```

This maps 1:1 to the epics in the MVP plan. Each service/package README links back to the user stories it owns.

## 🧱 Stack

- **Web:** Next.js · TradingView lightweight-charts
- **Backend:** TypeScript (NestJS) + Go for perf-critical ingestion
- **Data:** Postgres · TimescaleDB · Redis
- **Cardano data:** [Demeter.run](https://demeter.run) (Ogmios + Kupo + db-sync), Blockfrost free-tier fallback, [Charli3 Dendrite](https://pypi.org/project/charli3_dendrite/) for DEX parsing — see plan §6
- **Infra (MVP):** Hetzner + k3s (scrappy ~$50–100/mo) or managed PaaS (~$200/mo) — see plan §7

## 🚀 Getting started

```bash
nvm use                 # Node 20.18.0
npm install             # installs all workspaces
cp .env.example .env    # fill in secrets — NEVER commit .env
npm run dev:web         # start the web app
```

> ⚠️ **Secrets:** all credentials live in `.env` (gitignored) locally and in the host's secret store in prod. Never hardcode keys or commit real values.

## 🛠 First milestone (M0) — see plan §9

1. Stand up Demeter (Ogmios + Kupo + db-sync); confirm pricing in-dashboard.
2. Spike Charli3 Dendrite vs hand-rolled DEX adapters.
3. **Minswap vertical slice:** ingest → decode → VWAP → one token's live price + candle.
4. Pick ADA/USD oracle; provision Postgres/Timescale/Redis.
5. Scaffold app shell + CI/CD + Sentry/Grafana.

## 📋 Tracking

Work is tracked as GitHub Issues (one per user story, `US-x.y`) on the Basilisk Project board, grouped by epic and milestone.
