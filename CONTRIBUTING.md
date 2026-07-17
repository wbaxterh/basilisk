# Contributing to Basilisk

First off — thanks for taking the time to contribute! 🐍

Basilisk is an open, Cardano on-chain analytics, portfolio & trading platform (a TapTools alternative) with an agent-native (x402 / MCP) layer. This guide explains how to get set up and how we work.

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

> **Project status: pre-MVP.** We're building the foundations (chain ingestion, DEX adapters, pricing engine) first. Some feature stories are blocked until those land — check an issue's epic and dependencies before starting. See the [MVP plan](docs/BASILISK_MVP_PLAN.md) for the full picture.

---

## Ways to contribute

- **Code** — pick up a user story (see below) and open a PR.
- **Bugs** — open an issue with steps to reproduce, expected vs actual, and environment.
- **Ideas / feedback** — open a [Discussion](https://github.com/wbaxterh/basilisk/discussions) or an issue describing the problem (not just the solution).
- **Docs** — fixes and clarifications to docs are always welcome and a great first contribution.

## Finding something to work on

All work lives as **GitHub Issues**, one per feature/fix, on the **[Basilisk MVP project board](https://github.com/users/wbaxterh/projects/7)**.

Filter by these labels:

| Label | Meaning |
|-------|---------|
| [`good first issue`](https://github.com/wbaxterh/basilisk/labels/good%20first%20issue) | Self-contained, newcomer-friendly |
| [`help wanted`](https://github.com/wbaxterh/basilisk/labels/help%20wanted) | We'd love a hand here |
| `priority:must` / `should` / `nice` | MVP priority |
| `epic-*` | Area of the product (data, platform, portfolio, charts, …) |

The board also has **Points**, **Priority**, **Epic**, and **Milestone** (M0–M5) fields for grouping and sorting.

**Before you start:** comment on the issue to claim it so we don't duplicate work. If an issue is unclear, ask — we're happy to help scope it.

---

## Development setup

**Prerequisites:** Node ≥ 20.18.0 (`.nvmrc` provided), npm, git. A Cardano data provider (Demeter.run) and datastores are only needed for the data/service work — most frontend stories run without them.

```bash
git clone https://github.com/wbaxterh/basilisk.git
cd basilisk
nvm use
npm install            # installs all workspaces AND activates the git hooks
cp .env.example .env    # fill in only what your story needs
npm run dev:web         # http://localhost:3000
```

This is an **npm-workspaces monorepo**. See the [README](README.md#-monorepo-layout) for the full layout — briefly:

- `apps/web` — Next.js web app
- `apps/api-gateway` — BFF + public API
- `services/*` — ingestion, pricing, portfolio, alerts, notifications
- `packages/*` — `chain-data` client, `shared` types
- `docs/` — PRD, MVP plan, PDF generator

Useful scripts: `npm run typecheck`, `npm run build`, `npm run test` (all workspace-aware).

---

## Branch & PR workflow (enforced)

`main` is protected by a server-side ruleset — **no direct pushes**. Every change goes through a pull request.

```bash
git switch -c feat/short-slug                # feat|fix|docs|chore/<slug>
# … make your change, with tests …
git commit -m "feat: add chain-data client

Closes #1"
git push -u origin HEAD                        # then open a PR
gh pr create --fill                            # or via the web UI
```

**Conventions**
- **Branch:** `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, or `chore/<slug>`.
- **PR title:** `feat|fix|docs|chore: short description`. Reviews: @wbaxterh is a required code-owner reviewer on every PR.
- **PR body:** must reference the issue with `Closes #<n>` and complete the Definition-of-Done checklist (auto-added from the PR template).
- **Merge:** squash (keeps `main` linear). Delete the branch after merge.

**What's required to merge**
- ✅ The **`build`** CI check passes (install → typecheck → lint → test → build).
- ✅ Branch is **up to date** with `main`.
- ✅ All review conversations resolved.

A local **pre-push hook** (`scripts/git-hooks/pre-push`, activated by `npm install`) stops accidental pushes to `main` before they leave your machine.

### Definition of Done
Reviewed + merged · tests pass · meets the story's acceptance criteria · instrumented (logs/metrics) · **no secrets in code** · docs updated · deployed to staging & smoke-tested. **Data stories** also require a correctness cross-check against an external source (Blockfrost / the DEX's own UI).

---

## Coding standards

- **TypeScript**, strict mode (`tsconfig.base.json`). Keep `npm run typecheck` clean.
- Prefer small, focused PRs tied to a single story.
- Add tests for logic; data/pricing code especially needs correctness tests with fixtures.
- _(Linting/formatting config — ESLint + Prettier — is being added; match the surrounding style until then.)_

## Security & secrets

**Never commit secrets.** Local dev uses `.env` (gitignored). CI/deploy uses GitHub Actions secrets — set them yourself so values never pass through a PR or another person:

```bash
gh secret set DEMETER_API_KEY --repo wbaxterh/basilisk   # gh prompts for the value
# …see .env.example for the full list.
```

Found a security issue? **Do not open a public issue.** Email the maintainer (below) directly.

## License

Licensing is being finalized. Until a `LICENSE` file lands, contributions are made on the understanding they'll be released under the project's chosen open-source license. Track this in the issues.

## Getting help

- 💬 [GitHub Discussions](https://github.com/wbaxterh/basilisk/discussions)
- 🐞 [Issues](https://github.com/wbaxterh/basilisk/issues)
- 📧 Maintainer: Wes Huber — wesleybaxterhuber@gmail.com

Happy building! 🐍
