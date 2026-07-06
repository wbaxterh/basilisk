# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Basilisk project.

ADRs document significant architectural decisions with context, alternatives considered, and rationale. They are numbered sequentially and never deleted — superseded decisions are marked as such.

## Format

Each ADR follows [Michael Nygard's template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

- **Title** — short noun phrase
- **Status** — proposed, accepted, deprecated, superseded
- **Context** — what forces are at play
- **Decision** — what we decided
- **Consequences** — what happens as a result

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [001](001-kupmios-primary-chain-data.md) | Kupmios as primary chain data provider | Accepted (deferred to Phase 2+, see ADR-002) | 2026-06-03 |
| [002](002-public-free-data-architecture.md) | Public free APIs (DexScreener + Koios + CoinGecko + handle.me) as Phase-0 data plane | Accepted | 2026-07-06 |
| [003](003-api-v1-from-nextjs-routes.md) | Public /api/v1 from Next.js route handlers on Vercel | Accepted | 2026-07-06 |
| [004](004-mcp-server-in-app.md) | MCP server hosted in-app via mcp-handler | Accepted | 2026-07-06 |
