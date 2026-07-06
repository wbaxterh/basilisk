# Basilisk API Gateway — Hosting Plan

**Owner:** Wes Huber · **Status:** Draft v0.1 · 2026
**Scope:** Where the Fastify API gateway, ingestion workers, and (eventually) Kupmios live as we grow from zero users to a public beta.

---

## TL;DR

| Phase | Users | Hosting | Monthly cost | Why |
| --- | --- | --- | --- | --- |
| **Phase 0 — Pretend** | 0–50 | **No gateway hosted yet.** Frontend calls Koios + CoinGecko directly. | **$0** | We're here today. Validates demand without infra. |
| **Phase 1 — MVP** | 50–500 | **Railway** Fastify service + Vercel-managed Postgres (Neon) + Upstash Redis. Blockfrost as data provider. | **$5–25** | One platform, persistent containers, no rewrites. Generous free tiers. |
| **Phase 2 — Beta** | 500–5,000 | **Fly.io** with multi-region Fastify replicas + Neon Pro + Upstash Pro + Blockfrost paid. | **$50–150** | Global edge, predictable scaling, still no node ops. |
| **Phase 3 — Self-hosted chain data** | 5,000+ | Phase 2 setup + a **Hetzner / DigitalOcean dedicated** for Kupmios (Cardano node + Ogmios + Kupo). | **$120–300** | Differentiation. Stop paying per-request to Blockfrost. Required for x402 unit economics. |

We commit to nothing in Phase 0 that locks us out of Phase 3.

---

## Phase 0 — Where we are today

**The waitlist landing + whitepaper are on Vercel free tier.** The dashboard UI reads Cardano chain data directly from [Koios](https://www.koios.rest) and prices from [CoinGecko](https://www.coingecko.com) via client-side fetches. Both are CORS-friendly, no-auth, free.

**Limits we'll hit:**
- CoinGecko free tier: 10–30 req/min from a single IP. Browser-side calls go from each user's IP, so we get an effective N× multiplier. Acceptable up to a few hundred concurrent viewers.
- Koios: public infra, no documented per-IP limit but courtesy expected. Fine for landing + dashboard.

**What we cannot do in Phase 0:**
- DEX-specific OHLCV (Minswap, Wingriders, etc. — needs our own ingestion or TapTools API)
- Wallet-grade portfolio P&L (requires per-address chain queries that aren't on Koios v1)
- API keys + rate limiting for our own users
- x402 micropayment endpoints
- MCP server

Those need Phase 1.

---

## Phase 1 — MVP (the imminent target)

**Goal:** Stand up the existing Fastify API gateway publicly with persistent Postgres + Redis and Blockfrost-backed chain queries.

### Pick: **Railway**

Railway runs Fastify as-is in a container, gives us a persistent process, auto-deploys from GitHub, and has Postgres + Redis sidecar templates one click away. Free tier is $5/mo credit; a small Fastify + Redis + Postgres trio runs under that for early traffic.

### Architecture

```
Vercel (landing + dashboard + waitlist API)
    │
    │  HTTPS GET /v1/...
    ▼
Railway (Fastify gateway)
    ├── Postgres (Neon — shared with waitlist)
    ├── Redis (Upstash — pay-per-command, ~$0)
    └── Blockfrost provider (paid: $0 free tier)
```

### What we configure

- **Railway project:** one repo, one service for `apps/api-gateway`.
- **Build command:** `npm install --workspace apps/api-gateway && npm run build --workspace packages/shared --workspace packages/chain-data && npm run build --workspace apps/api-gateway`
- **Start command:** `npm run start --workspace apps/api-gateway`
- **Env vars:**
  - `DATABASE_URL` (Neon Postgres, same project as waitlist or a sibling DB)
  - `REDIS_URL` (Upstash)
  - `BLOCKFROST_PROJECT_ID` (free tier: 50k req/day, https://blockfrost.io)
  - `RESEND_API_KEY` (for alerts)
- **Custom domain:** none yet — Railway gives `<service>.up.railway.app`. Map a CNAME when we buy a real domain.

### Cost model (Phase 1)

| Item | Free tier | Estimated paid |
| --- | --- | --- |
| Railway Fastify | $5/mo credit | ~$5 once exceeded |
| Neon Postgres | 0.5 GB storage | $0 → $19/mo at scale |
| Upstash Redis | 10k cmd/day | $0–10 |
| Blockfrost | 50k req/day | $0 → $29/mo |
| **Total** | **$0** | **$5–25/mo** |

### Why not Vercel functions for the gateway?

- Fastify isn't designed for serverless cold starts — we'd rewrite as Next.js Route Handlers.
- 60s function limit on Pro, 10s on Hobby. WebSocket / streaming endpoints are awkward.
- No long-lived connections, which means no in-process caches, no pooled Blockfrost client, no Redis pub/sub.
- We'd lose the existing rate-limit middleware and a lot of the Fastify ecosystem.

For one-off endpoints (waitlist signup, simple CRUD), Vercel functions are fine — and that's where `/api/waitlist` already lives. For the analytics gateway, persistent process wins.

### Why not Fly.io for Phase 1?

We'll be there for Phase 2. Fly is better for multi-region + larger fleets and has a steeper learning curve. Railway's DX is closer to "git push and forget" which is what we want at the MVP stage. Migration from Railway → Fly is a Dockerfile away (Fastify already containerizes cleanly).

---

## Phase 2 — Beta (50–500 paying / heavy users)

**Triggers:**
- Blockfrost paid tier > $30/mo
- p95 latency from a US-only Railway region > 300ms for non-US users
- We've published the x402 + MCP rails and an agent base of meaningful traffic is hitting us

**Move to Fly.io:**
- Multi-region Fastify deployment (US East + EU)
- Fly Postgres (or stay on Neon) + Fly Redis (or stay on Upstash)
- Upgrade Blockfrost to a paid plan ($29/mo for 100k req/day, $99/mo for 1M)
- Add Sentry + a real metrics pipeline (Grafana Cloud free tier handles us)

**Cost ceiling at Phase 2:** ~$150/mo. Real but small.

---

## Phase 3 — Self-hosted Cardano infrastructure

**Trigger:** Blockfrost paid tier > $100/mo and rising, OR we want to expose endpoints Blockfrost doesn't (mempool tracking, custom indexers, MEV-style data).

**Setup:**
- One Hetzner AX41 or DigitalOcean Premium 8GB instance (~$60–120/mo)
- Cardano node + Ogmios + Kupo + Postgres-for-chain-data
- Kupmios runs on the same box as a stateful pipeline
- Fastify gateway stays on Fly, talks to our Kupmios over the Fly private network or a TLS-tunneled public endpoint
- Blockfrost kept as warm failover via `FailoverProvider` (already coded — see `packages/chain-data/src/providers/failover.ts`)

**Why we still want Blockfrost as failover:** initial chain sync takes hours/days, and node restarts during ops have to not page the on-call. Failover lets us flip providers in seconds.

**Cost ceiling at Phase 3:** ~$300/mo all-in. Becomes break-even vs Blockfrost paid tier around 1M req/day.

---

## Migration choices we're making now

| Choice | Reason |
| --- | --- |
| Frontend talks to public APIs in Phase 0 | Zero infra to validate the landing + dashboard |
| Waitlist API on Vercel functions | One-off endpoint, no persistent process needed, free |
| Analytics gateway on Railway (Phase 1) | Persistent Fastify, generous free tier, easy migration to Fly |
| Postgres on Neon | Already wired for waitlist, scales with us through Phase 2 |
| Blockfrost as the data provider (Phase 1) | Codebase already has the adapter. Lets us defer node ops. |
| Provider failover pattern | Built into `chain-data` package. Switch providers without code changes. |
| Container-first architecture | Both Railway and Fly run from a Dockerfile. Migration is config, not rewrite. |

---

## What we are NOT doing

- **No Kubernetes.** Until we have an oncall rotation, k8s is a tax.
- **No multi-cloud.** Vercel + Railway + Upstash + Neon are already four vendors — anything else needs justification.
- **No premature optimization on chain sync.** Blockfrost's 50k req/day free tier outlasts every internal cost optimization for at least the first six months.
- **No agent rails in Phase 0/1.** x402 + MCP land in Phase 2 once the human-facing product proves demand.

---

## Open questions

1. **Domain.** When we buy a real domain (anything besides `basilisk-seven.vercel.app`), we get a free Vercel custom domain and a clean Railway endpoint mapping. Until then, the `.vercel.app` and `.railway.app` subdomains do the job.
2. **Auth.** Phase 1 still uses raw API keys (already coded in `apps/api-gateway/src/middleware/apiKey.ts`). When we onboard agents, x402 replaces keys for paid usage; humans keep keys.
3. **Observability.** Railway logs are good enough for Phase 1. Phase 2 adds Sentry + a metrics layer. Pick a metrics platform when we get there — leaning Grafana Cloud free tier.

---

## Decision triggers (when to move phases)

- **Phase 0 → Phase 1:** First paid user OR first agent integration request OR the dashboard needs an endpoint that Koios doesn't expose.
- **Phase 1 → Phase 2:** Sustained traffic > Blockfrost free tier OR first non-US user complains about latency OR we ship MCP server alpha.
- **Phase 2 → Phase 3:** Blockfrost monthly bill > $100 with a clear scaling trajectory OR we need a chain endpoint no public provider exposes.

Each transition is a 1–2 day project, not a re-architecture. That's the whole point.
