# ADR-008: Token Logo Pipeline — Registry PNGs Proxied, GeckoTerminal Redirect Map, SVG Monogram Fallback

**Status:** Accepted
**Date:** 2026-07-11
**Deciders:** @wbaxterh

## Context

v0.5 puts token logos on every surface — screener rows, token detail headers, search results, portfolio holdings, movers. Until now the UI hotlinked whatever `imageUrl` DexScreener happened to include in a pair payload, which meant most tokens rendered a broken-image placeholder and the ones that did render pulled bytes from a third-party CDN on every page view.

**Coverage facts (verified against the 30-token curated registry, 2026-07-11):**

- **Cardano Token Registry** metadata, fetched via Koios `asset_info` (`token_registry_metadata.logo`, a base64-encoded PNG): **30/30** tokens have logo art. Average decoded size ~33 KB.
- **GeckoTerminal** `image_url` on token payloads: good coverage for GT-indexed tokens, but it's a third-party CDN URL that can churn, and GT's ~10 req/min budget (ADR-005) rules out resolving it at request time.
- **DexScreener** `info.imageUrl`: **3/30**. Not a viable source.

Forces:

- Base64 PNG blobs can't ride inside JSON responses at screener scale (30 × ~33 KB per response); logos need their own cacheable URL.
- Hotlinking third-party CDNs makes render-time availability depend on someone else's uptime, rate limits, and URL stability — and leaks user traffic.
- A logo endpoint that can 404 forces every consumer to build its own fallback; an endpoint that **always returns an image** keeps `<img src>` dumb everywhere.
- Anything served as an image must actually be an image — registry metadata is community-submitted, so bytes must be validated before we put our origin behind them.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Hotlink DexScreener `imageUrl`** (status quo) | Zero work | **Rejected — 3/30 coverage**; third-party dependency at render |
| **Hotlink GeckoTerminal `image_url`** | Good coverage for GT-indexed tokens | Third-party CDN at render time, URL churn, and resolving fresh URLs burns the ~10 req/min GT budget (ADR-005) |
| **Commit PNGs as static assets** | Zero runtime dependency | Manual pipeline per token, repo bloat, guaranteed registry drift |
| **Own proxy endpoint: registry PNG → precomputed GT redirect → SVG monogram** (chosen) | 30/30 today, always returns an image, our CDN in front, no upstream at render on the happy path | Koios dependency at cache-fill time; served PNGs are unoptimized (~33 KB avg) |

## Decision

Ship a dedicated logo route, `GET /api/v1/tokens/{asset}/logo`, that **always returns an image**, resolved through three tiers (same module-scope bounded cache + in-flight dedupe + serve-stale-on-error idioms as `dex-data.ts` / `gecko-data.ts`):

1. **Cardano Token Registry PNG (primary).** Koios `asset_info` → `token_registry_metadata.logo`, base64-decoded server-side. Bytes are **validated against the PNG magic sequence** (`\x89PNG\r\n\x1a\n`) before serving — anything that fails validation falls through to the next tier instead of being served from our origin. Valid PNGs are returned as `image/png` with a **long CDN cache** (`s-maxage` on the order of a day, plus stale-while-revalidate), so repeat views are pure CDN hits. Coverage: 30/30 of the curated registry.
2. **Precomputed GeckoTerminal redirect map (secondary).** A build-time map from asset unit → GT-hosted image URL, answered as a `302` redirect. Because the map is precomputed, this tier makes **zero GT API calls at request time** — it spends none of the ADR-005 budget.
3. **Deterministic SVG monogram (fallback, negative-cached).** Generated from the token's ticker with a hash-derived background color — the same token always gets the same art, so lists stay visually stable. Served with a **shorter cache TTL than the PNG tier** (negative caching): a token that later gains registry art heals automatically instead of being pinned to its monogram for a day.

All UI surfaces point their `<img src>` at this route; no component ever holds a third-party image URL.

## Consequences

### Positive
- **Zero third-party dependency at render on the happy path** — the browser only ever talks to Basilisk; registry PNG bytes come off our CDN edge after first fill. Koios is a cache-fill dependency, not a render dependency.
- **Every surface always gets an image** — no broken-image icons, no per-component fallback logic, no layout shift; the contract is "an image, always", and the tiers are an implementation detail behind one URL.
- **30/30 coverage today** via the registry, versus 3/30 from the rejected DexScreener source.
- **PNG-magic validation** means community-submitted registry bytes can't put non-image content behind our origin.
- **GT budget untouched** — the redirect tier is precomputed, so logos add zero load to the tightest upstream we have.

### Negative
- **~33 KB average PNG served as-is** — registry art is stored at whatever size it was submitted; a downscale/re-encode pass (small WebP variants) is **deferred**, so screener pages pay full bytes-on-wire until it lands.
- **Registry drift needs monitoring** — 30/30 was verified point-in-time; new registry submissions, replaced art, or removals aren't detected automatically yet, and negative-cached monograms delay pickup of late-added art by one TTL.
- **Cold cache + Koios outage → monograms** — if Koios is down and nothing is cached, affected tokens render fallback art until serve-stale or a refill saves them. Degraded, never broken.
- **Redirect tier inherits GT CDN availability** for tokens it covers, and a churned GT URL means a dead redirect until the map is regenerated.

### Follow-up work
- Downscale/re-encode pass: pre-size to the largest rendered dimension and serve WebP with PNG fallback
- Periodic registry re-sweep to catch drift (new/changed/removed logos) and regenerate the GT redirect map
- Surface logo-tier hit rates (png / redirect / svg) in logs so coverage regressions are visible
