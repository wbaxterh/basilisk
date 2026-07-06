# ADR-004: MCP Server Hosted Inside the Next.js App via mcp-handler

**Status:** Accepted
**Date:** 2026-07-06
**Deciders:** @wbaxterh

## Context

"Agent-native from day one" is Basilisk's differentiation against the TapTools model, and the Model Context Protocol is the de-facto standard for exposing tools to LLM clients (Claude Code, Claude Desktop, Cursor, and a growing list). We want agents querying Cardano market data with zero onboarding — no key, no install, one URL.

The data the tools need is the same data plane as `/api/v1` (ADR-002/003): the shared fetchers in `apps/web/src/lib/dex-data.ts`. The question is where the MCP server lives.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Separate MCP service** (own deploy) | Independent scaling/lifecycle | Second deploy + cost, duplicates or re-imports the data layer over HTTP, slower to ship |
| **stdio-only npm package** (`npx basilisk-mcp`) | Works offline-ish, no hosting | Every user installs + updates it; no zero-setup URL; still needs a data API behind it; worst onboarding for the "one line to connect" story |
| **Hosted in apps/web via `mcp-handler`** (chosen) | One deploy, in-process access to `dex-data.ts` + its cache, instant zero-install connect URL | Coupled to web app lifecycle; Vercel function limits; SSE transport needs Redis we don't run |

## Decision

Host the MCP server **inside the Next.js app** at `/api/mcp` using the **`mcp-handler`** package (Vercel's adapter exposing an MCP server as an App Router route handler):

- **Transport: streamable HTTP only.** Modern MCP clients support it, and it works statelessly on serverless. We do **not** enable the legacy SSE transport, which requires Redis for session state — no Redis in Phase 0 (aligned with ADR-003's zero-infra stance).
- **Tools mirror `/api/v1` one-to-one:** `search_tokens`, `get_screener`, `get_token`, `get_wallet`, `get_ada_price`, `get_chain_tip` — thin wrappers over the same `dex-data.ts` functions the REST routes call, sharing the same module cache and coverage guarantees (every DEX aggregate carries the SundaeSwap + WingRiders coverage field).
- **No auth, read-only.** Same free/keyless policy as the REST API; every tool is a pure read. x402-gated premium tools are a future concern (in development, per the x402 docs).
- **Connect story:** `claude mcp add --transport http basilisk https://basilisk-seven.vercel.app/api/mcp` — one line, no account.

## Consequences

### Positive
- **Zero-install agent onboarding** — a URL, not a package; works in Claude Code/Desktop and Cursor today
- **No duplicated data logic** — tools and REST share one in-process data layer, one cache, one coverage-honesty rule
- **$0 incremental infra** — no Redis, no second service
- **Ships with v0.2** — agent-native positioning is backed by a live endpoint, not a roadmap slide

### Negative
- **No SSE transport** — clients that only speak legacy SSE can't connect until we either add Redis or they upgrade (streamable HTTP is the standard's direction, so we accept this)
- **Coupled lifecycle** — same as ADR-003: web deploys can break the MCP endpoint
- **Serverless statelessness** — no long-lived subscriptions/notifications; fine for request/response tools, a limitation for future streaming tools (e.g. live trades feed)
- **Vercel limits** — long-running tool calls are bounded by function timeouts

### Follow-up work
- Add the MCP endpoint to uptime monitoring alongside `/api/v1`
- Revisit transport (Redis-backed sessions or a dedicated service) when streaming tools (live trades feed) leave development
- Consider a thin stdio shim package later purely as a compatibility layer — it would proxy to the hosted server, not reimplement it
