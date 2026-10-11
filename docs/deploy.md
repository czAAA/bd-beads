# Deploy

How the app and its backend reach Cloudflare (ticket 71, spec 385, [ADR 0014](adr/0014-mvp-stays-local-only-hosted-phase-deferred.md)). What to watch once it runs, and when to switch a feature off or pay for more, is the runbook, `docs/operations.md` (private docs repo, linked in by `scripts/link-docs.sh`).

**Draft.** Written in ticket 71 step A1, before anything exists on Cloudflare. Step A2 creates the resources and the deploy workflow and fills in what is marked *(A2)*; step A5 finishes this page.

## What runs where

One Cloudflare account, on Workers Free, runs two Workers from one `wrangler.jsonc`:

| | dev | production |
|---|---|---|
| Worker | `bd-beads-dev` | `bd-beads` |
| Deployed | on every push to `main` *(A2: the workflow)* | by a manual run of the workflow, from `main` only |
| D1 `core` (binding `CORE`) | `bd-beads-dev-core` | `bd-beads-core` |
| D1 `blobs` (binding `BLOBS_DB`) | `bd-beads-dev-blobs` | `bd-beads-blobs` |
| R2 (binding `BLOBS`) | `bd-beads-dev` | `bd-beads` |
| Access | always | until the public release (ticket 391) |

Each Worker serves the built app and the Overview as static assets at its root, and runs its code only for `/api/*` (`run_worker_first`), so loading the app never counts as a Worker request and keeps working when `/api` is over its daily cap or switched off. The code is `worker/` (`CODING_STANDARDS.md`). The two databases are apart so a full `blobs` can't stop sign-in ([ADR 0049](adr/0049-core-and-blobs-are-separate-d1-databases.md)).

## Deploying by hand

Needs `npx wrangler login` on the machine (wizard phase H2). From the repo root, after `npm ci`:

```sh
DEPLOY_BASE=/ npm run build
npx wrangler d1 migrations apply CORE --env dev --remote
npx wrangler d1 migrations apply BLOBS_DB --env dev --remote
npx wrangler deploy --env dev --var VERSION:$(git rev-parse --short HEAD)
curl -s https://<dev host>/api/health
```

Production is the same with `--env production`, from a clean `main`. `npx wrangler deploy --dry-run --env <env>` checks the config and the bundle without touching Cloudflare.

*(A2: the workflow, `.github/workflows/deploy.yml`, does the same: one build, each database's migrations, then the code, then a smoke check that `/api/health` answers with the new version.)*

## Migrations

Each database has its own folder: `worker/migrations/core/` (empty until ticket 78) and `worker/migrations/blobs/`. A migration is a numbered `.sql` file, applied in order by `wrangler d1 migrations apply <binding>`, before the code that needs it.

**Add, then remove.** A migration only adds: a new table, a new nullable column. A column or table is dropped in a later deploy, once no deployed code reads it. A deploy that fails after its migration then leaves the running code working on the new schema. `wrangler rollback` brings back old code but never undoes a migration; D1 Time Travel does (`docs/operations.md`, restore).

The tests apply every migration before each Worker starts (`docs/testing.md`), so a broken one fails the suite.

## Variables and secrets

**Variables** are declared per environment in `wrangler.jsonc`: the Worker's name and script, the ids its watchdog filters by, every upload cap, the blob storage limit and every warn level. Change one there and deploy, or in the dashboard for a quick trial (a later deploy puts the file's value back). `keep_vars` keeps the variables that aren't in the file.

**`DISABLED_FEATURES` is never in `wrangler.jsonc`.** It is the kill switch, set by hand in the dashboard (Workers → the Worker → Settings → Variables), comma-separated feature names (`worker/src/features.ts`). Because the file doesn't declare it, deploys leave it alone.

**Secrets** are never in the repo. Each is set per Worker with `npx wrangler secret put <NAME> --env <dev|production>`, which asks for the value hidden:

| Secret | What | Set in |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile's secret key | wizard H3c |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | wizard H3b |
| `HEALTHCHECK_URL` | this Worker's Healthchecks.io ping URL | wizard H3d |
| `CF_ANALYTICS_TOKEN` | read-only Account Analytics token, for the watchdog | wizard H3d |

GitHub holds only what CI needs, in the `production` environment (limited to `main`): the secret `CLOUDFLARE_API_TOKEN` (this account only, Workers Scripts edit and D1 edit), the variable `CLOUDFLARE_ACCOUNT_ID`, and for the backup the secret `HEALTHCHECK_BACKUP_URL` and the variable `AGE_PUBLIC_KEY`.

## The human steps

The steps that need the maintainer's login, card or judgment are in `scripts/backend-wizard.sh`, one phase per run (`h1` to `h5`), in the order ticket 71 gives. It opens each dashboard, says what to click, sends each secret straight to Wrangler or GitHub, and writes the ids, site keys and hosts it collects (none secret) to `backend-handoff.local` (gitignored) for the agent.

## Still to write (A5)

- How to add a tester (an email in each Access policy).
- How a fork deploys its own copy: its own account, the resource names in `wrangler.jsonc`, its own secrets.
