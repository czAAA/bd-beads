# Deploy

How the app and its backend reach Cloudflare, and how to change that. What to watch afterwards, and the rules for stopping and paying, are the maintainer's private runbook. The design: spec 385 (ticket 71).

> **Draft (ticket 71, step A1).** The Worker and its config exist; the Cloudflare resources and the workflow are created in step A2, and the "Workflow" and "Settings" parts below describe what A2 builds. Delete this note then.

## What is deployed

One Cloudflare account, two Workers (`bd-beads-dev`, `bd-beads`), each serving:

- the built app at `/` and the Overview at `/overview/`, as static assets (`dist/`, built with `DEPLOY_BASE=/`);
- the backend under `/api/*`. The Worker runs **only** for `/api/*` (`run_worker_first`), so loading the app never counts as a Worker request and keeps working when `/api` is over its cap or switched off.

Each Worker has its own D1 database and R2 bucket, bound to it alone. Both sit behind Cloudflare Access until the public release, with `/api/health` bypassed so CI and UptimeRobot can reach it.

Where things are: `wrangler.jsonc` (the two environments), `worker/src/` (the Worker), `worker/migrations/` (D1 migrations), `worker/test/` (its tests), `scripts/backend-wizard.sh` (the maintainer's steps).

## The API contract

JSON in and out; no CORS (the app and the API share one origin). `GET /api/health` answers `200 {"ok":true,"worker":"dev|production","version":"<git sha>"}` after one D1 read. A refusal is `{"error":"<code>", ...}`:

| Status | Code | Extra fields |
|---|---|---|
| 404 | `not-found` | |
| 403 | `turnstile-failed` | |
| 413 | `too-large` | `cap` (bytes) |
| 429 | `rate-limited` | `retryAfter` (seconds; also the `Retry-After` header) |
| 503 | `feature-off` | `feature` |
| 503 | `unavailable` | |

A route that creates something sends the Turnstile token in the `X-Turnstile-Token` header. New routes are added in `worker/src/index.ts` with the guards in `worker/src/guards.ts` (`turnstile`, `sizeCap`, `rateLimit`) and store blobs only through `worker/src/blobs.ts`. A handler reads its body with `readBody` (never `request.json()` directly), which is what enforces `sizeCap` on a body sent without a length.

## Run it locally

```
npm ci
DEPLOY_BASE=/ npm run build              # the app, for the Worker's assets
npx wrangler d1 migrations apply DB --env dev --local
npx wrangler dev --env dev               # http://localhost:8787, local D1 and R2 in .wrangler/
```

The Worker's tests need no Cloudflare account: `npx vitest run --project worker` (they start workerd through Miniflare).

## Migrations

D1 migrations are SQL files in `worker/migrations/`, numbered (`0002_<name>.sql`) and applied in order. Create one with `npx wrangler d1 migrations create DB <name> --env dev`, then apply:

```
npx wrangler d1 migrations apply DB --env dev --remote          # dev first
npx wrangler d1 migrations apply DB --env production --remote
```

The workflow applies them before the new code goes out, dev first, so a migration must keep the *previous* code working (add, don't rename or drop, in one step). A broken deploy cannot touch data: code and storage fail separately, and D1 Time Travel restores the last 7 days.

## Deploy by hand

```
DEPLOY_BASE=/ npm run build
npx wrangler d1 migrations apply DB --env dev --remote
npx wrangler deploy --env dev --var VERSION:$(git rev-parse HEAD)
curl -s https://<dev host>/api/health        # the version must be the commit
```

Production is the same with `--env production`, and only when you mean it.

## Workflow

`.github/workflows/deploy.yml` (written in step A2): one build; **dev deploys on every push to `main`**; **production deploys only on a manual run or a `v*` tag**; migrations run before the code; a smoke check calls `/api/health` and fails the run unless it reports the new version; a `concurrency` group keeps deploys from overlapping; every action is pinned to a commit SHA.

## Settings

GitHub, in the `production` environment (limited to the `main` branch, so no branch, pull request or fork can deploy):

| Kind | Name | Meaning |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Custom token for this account only: Workers Scripts edit and D1 edit, nothing else |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | The account id (not secret) |

Cloudflare, per Worker (set with `npx wrangler secret put <NAME> --env <dev|production>`; never pasted into a chat, a file or a log):

| Name | Kind | Used by |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | secret | the Turnstile guard |
| `GOOGLE_CLIENT_SECRET` | secret | sign-in (ticket 78) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | secret | the watchdog's messages |
| `HEALTHCHECK_URL` | secret | the watchdog's heartbeat (a different URL per Worker) |
| `CF_ANALYTICS_TOKEN` | secret | the watchdog's analytics reader, only if `USAGE_SOURCE=graphql` |
| `DISABLED_FEATURES` | variable | kill switches; set in the dashboard, not in the config, so a deploy keeps it |
| `USAGE_SOURCE` | variable | `d1` (default) or `graphql` |
| `CF_ACCOUNT_ID`, `D1_DATABASE_ID` | variable | the analytics reader (production's database id) |
| `WATCHDOG_LEVEL_FACTOR` | variable | lowers the watchdog's levels, to try alerts on dev |
| `SWITCHES_CACHE_SECONDS` | variable | how long an isolate keeps D1's switches (default 60) |

Variables set in the dashboard survive deploys (`keep_vars`). Anything declared under `vars` in `wrangler.jsonc` is put back on every deploy, so only `WORKER_NAME` is declared there.

To rotate a secret, run `npx wrangler secret put <NAME> --env <env>` again; no deploy is needed.

## The maintainer's steps

`bash scripts/backend-wizard.sh h1` … `h4` walks through every step that needs your login, card or judgment, in order (the agent's steps sit between them); see the ticket for the order. It saves only ids, site keys and host names, to `backend-handoff.local` (gitignored); secrets go straight to Cloudflare or GitHub.

## Add a tester

Cloudflare Zero Trust → Access → Applications → each Worker's application → Policies → add the person's email to the Allow policy. They sign in with a one-time PIN sent to that address; no Cloudflare account is needed. While Google's consent screen is in Testing, add them as a test user there too (up to 100).
