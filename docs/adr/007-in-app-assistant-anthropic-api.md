# ADR-007: In-App "Ask Basilisk" Assistant via the Anthropic API

**Status:** Accepted
**Date:** 2026-07-07
**Deciders:** @wbaxterh

## Context

Basilisk already exposes one tool surface over three consumers: the UI components, the public `/api/v1` REST routes (ADR-003), and the hosted MCP server (ADR-004) — all thin wrappers over the same `dex-data.ts` functions, sharing one module cache and one coverage-honesty rule. Users who connect Claude to the MCP server get a conversational analyst over live Cardano data for free; users who just open the app get nothing conversational at all. An in-app "Ask Basilisk" chat closes that gap without asking anyone to install an MCP client.

Constraints from the existing architecture:

- **Zero-infra Phase 0 (ADR-002/003)** — no new services, no queue, no vector store. The only stateful store in the stack is Neon serverless Postgres (waitlist, community layer per ADR-006), so any persistence for chat must fit that precedent or be optional.
- **One tool surface** — the moment chat gets its own bespoke data fetchers, the coverage guarantees (every DEX aggregate carries its `coverage` field) fork. The assistant must call the exact same dex-data functions the MCP tools wrap, so a wrong answer in chat is the same wrong answer everywhere and gets fixed once.
- **Cost exposure** — unlike every other Basilisk surface, LLM inference is not free to serve. An unauthenticated public chat endpoint is an open wallet unless spend is bounded structurally.
- **No accounts** — Basilisk has no login, so quotas can only key on what an anonymous request carries (IP).

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Client-side Anthropic key** (browser calls the API directly) | No server code, no streaming proxy | **Rejected outright — key exposure.** Any key shipped to the browser is public within minutes; violates the repo's hard no-secrets rule |
| **Anthropic Managed Agents** (server-managed sessions + containers) | Anthropic runs the loop, per-session workspace, event stream | Overkill for stateless Q&A over six read-only tools: persistent agent objects, session containers, and an SSE session model we'd immediately flatten. Adds a second lifecycle to operate for no capability we need |
| **Haiku as default model** (`claude-haiku-4-5`) | ~5× cheaper per token | **Rejected as the default — quality-first.** The assistant is a product differentiator and answers feed trading decisions; the 20/day quota already bounds spend better than a cheaper model would. Model stays env-overridable, so downgrading later is a config change, not a code change |
| **Next.js route + manual streaming tool loop over dex-data** (chosen) | One deploy, in-process tool execution, same cache and coverage fields as UI//api/v1/MCP, full control over rounds/quota/stream | We own the loop code (tool dispatch, round caps, error surfaces); bounded by Vercel function timeouts |

## Decision

Ship "Ask Basilisk" as a Next.js App Router route handler (`/api/chat`) calling the **Anthropic Messages API** directly via the official SDK, with a **manual streaming tool loop** over the same dex-data functions the MCP server exposes:

- **Model: `claude-opus-4-8` by default, env-overridable** (`BASILISK_CHAT_MODEL`). Quality-first: the default is the strongest Opus-tier model; cost is bounded by quota, `max_tokens`, and the round cap rather than by model downgrade. **Adaptive thinking** (`thinking: {type: "adaptive"}`) is enabled so the model decides per-question how much to reason.
- **One tool surface, four consumers.** The chat loop's tools are the same six functions ADR-004 registered for MCP — `search_tokens`, `get_screener`, `get_token`, `get_wallet`, `get_ada_price`, `get_chain_tip` — imported from `dex-data.ts` and executed in-process. UI, `/api/v1`, MCP, and now chat all read through one data layer, one cache, one coverage field. No chat-only fetchers, ever.
- **Prompt caching:** the system prompt and tool definitions are frozen (no timestamps, deterministic tool order) and carry a `cache_control: {type: "ephemeral"}` breakpoint, so every turn after the first reads the system+tools prefix at cache rates.
- **Manual streaming tool loop:** the handler streams each model turn, executes any `tool_use` blocks against dex-data, appends `tool_result`s, and re-sends — capped at a **fixed round limit** so a pathological loop cannot spin. Text deltas are forwarded to the client as they arrive.
- **NDJSON streaming contract:** the response is `application/x-ndjson`, one JSON object per line — `{type:"text", delta}`, `{type:"tool", name, status}`, `{type:"done", usage}`, `{type:"error", message}`. Plain `fetch` + line-splitting on the client; no SSE framing, no websockets, works through Vercel's streaming responses.
- **Stateless server-side.** No conversation store: the client sends its own history each request, capped (last N messages) before it reaches the model. Nothing chat-related is persisted except the quota counter.
- **Per-IP quota: 20 messages per UTC day**, enforced in Neon with a single **atomic upsert** (`INSERT ... ON CONFLICT (ip, day) DO UPDATE SET count = quota.count + 1 RETURNING count`) so concurrent requests cannot race past the limit. With no `DATABASE_URL` configured, an **in-memory fallback** map enforces the same limit per serverless instance (weaker — instances don't share state — but fails toward *some* limit rather than none). Over-limit → 429 with a friendly retry-tomorrow message.
- **Graceful 503 without `ANTHROPIC_API_KEY`:** if the key is unset, the route returns a clear 503 ("assistant not configured") and the UI shows a friendly disabled state — never a blank crash, matching the no-DB pattern from ADR-006.

## Consequences

### Positive
- **Conversational analytics with zero onboarding** — no MCP client, no key, no account; open the app and ask
- **One tool surface stays true** — chat inherits the coverage-honesty rule for free; a data fix lands in all four consumers at once
- **Cost exposure is bounded structurally** — per-IP daily quota × `max_tokens` ceiling × round cap gives a computable worst-case daily spend, independent of traffic
- **No new services** — Anthropic API + existing Neon; the in-memory fallback means even DB-less deploys degrade gracefully
- **Stateless by construction** — nothing to GDPR-audit, nothing to migrate; history lives in the client's tab

### Negative
- **Real money per message** — the first Basilisk surface with per-request COGS; quota tuning is now an operational concern, and a popular launch day is a bill
- **Per-IP quotas are blunt** — shared NATs (offices, campuses) exhaust one budget collectively, while VPN rotation can mint fresh IPs; acceptable for a free beta, not a billing boundary
- **In-memory fallback is per-instance** — without Neon, N warm serverless instances allow up to N× the quota; documented, not hidden
- **Client-held history is truncatable and forgeable** — the model only sees what the browser sends; capping history bounds cost but loses long-conversation context
- **Answers can be wrong** — an LLM over honest data can still misread it; the UI must carry a verify-before-trading disclaimer
- **Vercel timeouts bound the loop** — long multi-tool answers race the function limit; the round cap keeps this rare but real
- **Hard dependency on Anthropic availability** — an upstream outage disables chat (503), though every other surface keeps working

### Follow-up work
- Track per-day token spend (usage fields from the API) and alert before quota math stops covering it
- Revisit quota keying (wallet-signature-based allowances per ADR-006's identity primitive) if IP limits prove too blunt
- Evaluate a cheaper env-override model for routine questions once quality baselines exist
- Add the chat route to uptime monitoring alongside `/api/v1` and `/api/mcp`
