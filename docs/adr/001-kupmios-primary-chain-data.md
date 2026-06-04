# ADR-001: Kupmios (Ogmios + Kupo) as Primary Chain Data Provider

**Status:** Accepted
**Date:** 2026-06-03
**Deciders:** @wbaxterh

## Context

Basilisk needs reliable access to Cardano on-chain data for:
- **Block/transaction ingestion** — following the chain tip, extracting tx data
- **UTxO queries** — resolving wallet holdings, looking up addresses
- **DEX swap decoding** — reading transaction outputs to decode swap events

We initially built a `BlockfrostProvider` using the Blockfrost REST API (free tier: 50k req/day). This works for development but has limitations for production:

1. **Rate limits** — 50k requests/day on the free tier; paid tiers are per-request
2. **Polling-based** — we poll for new blocks instead of streaming
3. **No pattern-based indexing** — can't subscribe to specific script addresses
4. **Third-party dependency** — adds latency, availability risk, and cost scaling

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Blockfrost only** | Zero ops, free tier | Rate limits, polling, per-request cost |
| **Self-hosted cardano-node + db-sync** | Full data, no rate limits | Heavy ops (~100GB+ disk, sync time, maintenance) |
| **Kupmios (Ogmios + Kupo)** | WebSocket streaming, pattern indexing, lightweight | Requires running 2 services (or Demeter managed) |
| **Charli3 Dendrite** | Python SDK for DEX parsing | Python-only, doesn't cover ingestion/UTxOs |

## Decision

Adopt **Kupmios (Ogmios + Kupo)** as the primary chain data provider, with Blockfrost retained as a free-tier fallback.

- **Ogmios** (`@cardano-ogmios/client`) — WebSocket chain-sync for real-time block/transaction streaming. Replaces our polling loop with push-based data flow.
- **Kupo** (HTTP REST API) — Lightweight chain indexer for UTxO queries by address/pattern. Supports match patterns for DEX script addresses.
- **Demeter.run** — Managed Kupo + Ogmios ports (pay-per-use, scales to zero). Eliminates infrastructure burden for MVP.
- **Blockfrost** — Retained as fallback provider for cross-checking and development without Demeter.

### Provider selection at runtime

```
CHAIN_PROVIDER=kupmios  →  KupmiosProvider (Ogmios WS + Kupo HTTP)
CHAIN_PROVIDER=blockfrost  →  BlockfrostProvider (REST, polling)
```

The `ChainDataProvider` interface in `packages/chain-data` abstracts the choice — services program against the interface, not a specific backend.

## Consequences

### Positive
- **Real-time ingestion** — WebSocket chain-sync eliminates polling latency
- **Pattern-based indexing** — Kupo can index specific DEX script addresses, reducing noise
- **Cost-efficient at scale** — Demeter managed ports are cheaper than Blockfrost per-request at volume
- **Provider redundancy** — two independent data sources for cross-checking (US-0.7)

### Negative
- **More config** — services need Ogmios WS URL + Kupo HTTP URL (vs. one Blockfrost key)
- **Demeter dependency** — managed Kupmios ties us to Demeter (mitigated: can self-host)
- **SDK maturity** — `@cardano-ogmios/client` is maintained but less widely used than Blockfrost SDK

### Follow-up work
- Implement `KupmiosProvider` in `packages/chain-data`
- Add Ogmios + Kupo to Docker Compose for local dev
- Update ingestion service to use streaming chain-sync
- Add provider failover logic (primary → fallback)
