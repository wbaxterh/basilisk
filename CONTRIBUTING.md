# Contributing to Basilisk

## Branch & PR flow (enforced)

`main` is protected — **no direct commits**. Every change goes through a PR.

```bash
git switch -c feat/US-0.1-demeter-client   # branch name = feat/<story-id>-<slug>
# … work …
git commit -m "US-0.1: add Demeter chain-data client

Closes #1"
git push -u origin HEAD                     # opens the branch; create a PR
```

- **Branch naming:** `feat/US-x.y-slug`, `fix/US-x.y-slug`, or `chore/slug`.
- **PR title:** `US-x.y: short description`. Body must include `Closes #<issue>`.
- **Merge style:** squash (keeps `main` linear).
- CI (`build`) must pass before merge; the branch must be up to date with `main`.

### Definition of Done (plan §5)
Reviewed + merged · tests pass · meets acceptance criteria · instrumented · **no secrets in code** · docs updated · deployed to staging & smoke-tested. **Data stories** also require a correctness cross-check against an external source (Blockfrost / DEX UI).

## Local setup

```bash
nvm use            # Node 20.18.0+
npm install        # installs workspaces AND activates git hooks (core.hooksPath)
cp .env.example .env
npm run dev:web
```

The pre-push hook (`scripts/git-hooks/pre-push`) blocks direct pushes to `main`. It's activated automatically by `npm install`; to set it manually: `git config core.hooksPath scripts/git-hooks`.

## Secrets

**Never commit secrets.** Local dev uses `.env` (gitignored). CI/deploy uses GitHub Actions secrets — set them yourself so values never pass through anyone else:

```bash
# Repo-level Actions secrets (run locally; gh prompts for the value):
gh secret set DEMETER_API_KEY       --repo wbaxterh/basilisk
gh secret set BLOCKFROST_PROJECT_ID --repo wbaxterh/basilisk
gh secret set DATABASE_URL          --repo wbaxterh/basilisk
gh secret set REDIS_URL             --repo wbaxterh/basilisk
gh secret set JWT_SECRET            --repo wbaxterh/basilisk
gh secret set RESEND_API_KEY        --repo wbaxterh/basilisk
gh secret set SENTRY_DSN            --repo wbaxterh/basilisk
# …add the rest from .env.example as services need them.
```

CI does **not** require any secrets today (it only installs, typechecks, and builds). Add the above as deploy/integration jobs are introduced.

## CI

`.github/workflows/ci.yml` runs on every PR and on pushes to `main`: install → typecheck → lint → test → build (workspace-aware, `--if-present`). Keep it green.
