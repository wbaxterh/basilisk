# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via [GitHub Security Advisories](https://github.com/wbaxterh/basilisk/security/advisories/new) ("Report a vulnerability"). You'll get an acknowledgement within 72 hours and a status update within 7 days.

## Scope

- The `basilisk` monorepo (web app, `/api/v1`, `/api/mcp`, chat agent, community endpoints)
- The production deployments at `basilisk-seven.vercel.app` and `basilisk-docs.vercel.app`

Of particular interest: CIP-30/CIP-8 signature verification bypasses (community boosts/discussion), quota/rate-limit evasion, upstream-data injection (token metadata is attacker-mintable by design — rendering must stay safe), and anything that could burn metered API budgets (Anthropic, GeckoTerminal) from unauthenticated requests.

## Out of scope

- Denial of service via volume alone
- Issues in upstream data providers (DexScreener, Koios, GeckoTerminal, DefiLlama, CoinGecko, handle.me) — report to them, but tell us if we amplify the impact
- Social engineering, physical attacks

## Supported versions

Only the latest deployed version (main branch / production) is supported. There are no LTS branches.

Thanks for helping keep the Cardano community safe. 🐍
