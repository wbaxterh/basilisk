# ADR-003: Public /api/v1 Served from Next.js Route Handlers on Vercel

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** @wbaxterh

## Context

Basilisk's public positioning is "the free, agent-native successor to the TapTools API" — which means a public REST API is a launch requirement, not a later phase. The original architecture plan called for a standalone Fastify API gateway (deployed on Railway) fronting internal services. But Phase 0 has no internal services: the entire data plane is the free-API composition from ADR-002, living in `apps/web/src/lib/dex-data.ts`, and the web app already consumes it via server components.

Standing up Fastify now would mean: a second deploy target, duplicating the data layer (or extracting a shared package consumed across two runtimes), paying for an always-on Railway service, and putting an uncached hop in front of data that is inherently cacheable for 30–90 s.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Fastify gateway on Railway now** | "Proper" service boundary, framework-agnostic future | Second deploy + recurring cost, duplicated data layer, no CDN by default, slower to ship |
| **Vercel Edge Functions** | Cheap, fast cold starts | Edge runtime incompatible with parts of the data layer (`node:https` used for long Koios holder fills, `Buffer`) |
| **Next.js route handlers in apps/web** (chosen) | Zero extra infra, shares `dex-data.ts` in-process, Vercel CDN honors `s-maxage`, one deploy | API lifecycle coupled to web app deploys; Vercel function limits |

## Decision

Serve the public API as **Next.js App Router route handlers inside `apps/web`**, deployed with the web app on Vercel:

- Routes under `apps/web/src/app/api/v1/**`: index (`GET /api/v1`), `tokens`, `tokens/[asset]`, `search`, `wallet/[address]`, `market` — all `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Handlers are thin: parse input → call the shared `dex-data.ts` fetcher → set `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` → JSON out. Errors return `{ error, hint }` with 400/404/502.
- The Vercel CDN is the public rate-limit story for Phase 0: identical requests within the TTL never reach the function, and the module cache absorbs the rest.
- No authentication in Phase 0 (free and keyless is the wedge vs. TapTools' $9–199/mo). API keys arrive with a Pro tier; x402 pay-per-query is in development.

**The Fastify gateway is deferred to Phase 1 (Railway)**, triggered by any of: authenticated tiers with real rate limiting, endpoints backed by our own ingestion (ADR-001), or traffic/runtime limits that outgrow Vercel functions. The route handlers are already shaped like gateway endpoints, so the migration is a lift-and-shift of handler logic, not a redesign.

## Consequences

### Positive
- **Zero incremental infra cost** — the API rides the existing Vercel deploy
- **CDN caching for free** — `s-maxage` + `stale-while-revalidate` at the edge, which is exactly right for 30–90 s-fresh market data
- **Single deploy, single data layer** — app pages, `/api/v1`, and the MCP server share one in-process `dex-data.ts` cache
- **Shipped the same week TapTools' vacuum opened** — speed was the point

### Negative
- **Coupled lifecycle** — a broken web deploy takes the API down with it; no independent API versioning/rollback
- **Vercel function constraints** — execution time and memory limits bound what an endpoint can do (already visible in the holder-count background-fill workaround)
- **No real rate limiting** — CDN caching deters abuse but cannot enforce per-client quotas; acceptable only while the API is fully free
- **Serverless cache locality** — the module cache is per-instance; cold or scaled-out instances refetch (CDN absorbs most of this)

### Follow-up work
- Add lightweight request metrics (per-endpoint counts/latencies) to know when Phase 1 triggers fire
- Keep handler logic thin so the Fastify lift-and-shift stays cheap
- Document the API publicly (docs site) with the coverage caveats from ADR-002
