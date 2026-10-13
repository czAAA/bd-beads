# Deploy

How the app and its backend reach Cloudflare (ticket 71, spec 385, [ADR 0014](adr/0014-mvp-stays-local-only-hosted-phase-deferred.md)). What to watch once it runs, and when to switch a feature off or pay for more, is the runbook, `docs/operations.md` (private docs repo, linked in by `scripts/link-docs.sh`).

## What runs where

One Cloudflare account, on Workers Free, runs two Workers from one `wrangler.jsonc`:

| | dev | production |
|---|---|---|
| Worker | `bd-beads-dev` | `bd-beads` |
| Deployed | on every push to `main` | by a manual run of the workflow, from `main` only |
| Address | `https://dev.openbeads.com`, and `https://bd-beads-dev.bd4beads.workers.dev` | `https://openbeads.com`, and `https://bd-beads.bd4beads.workers.dev` until the release switches it off (ticket 391) |
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
npx wrangler deploy --env dev --var VERSION:$(git rev-parse HEAD)
curl -s https://bd-beads-dev.bd4beads.workers.dev/api/health   # or https://dev.openbeads.com/api/health
```

Production is the same with `--env production`, from a clean `main`. `npx wrangler deploy --dry-run --env <env>` checks the config and the bundle without touching Cloudflare.

## Deploying through GitHub

`.github/workflows/deploy.yml` does the same as the steps above:

- **When it runs.** A push to `main` deploys dev. Production deploys only from a manual run (Actions → Deploy → Run workflow, on `main`). A run from any other ref fails at once, and the `production` environment refuses it too.
- **What it does.** One build, then each database's migrations, then the code with `VERSION` set to the commit, then a smoke check. The smoke check retries `/api/health` for up to two minutes, until it answers `ok` with that commit. It takes the address from Wrangler's own record of the deploy. A second check asks the custom domain (`dev.openbeads.com` or `openbeads.com`) the same; it sends the Access service token when `CF_ACCESS_CLIENT_ID` is set (ticket 395), and dev's is skipped with a warning until then.
- **Custom domains.** Each Worker's `routes` entry in `wrangler.jsonc` is a Custom Domain, so a deploy keeps it. `PUBLIC_ORIGIN` is the origin sign-in is tried on; Google's callback and the allowed origins come from it, never from the request's host. Each hostname has its own Access application (ticket 400), so a tester is added to both policies.
- **Concurrency.** Runs for the same Worker queue one behind another and are never cancelled halfway through.
- **What it skips.** A push that changes only Markdown deploys nothing.

## Migrations

Each database has its own folder: `worker/migrations/core/` (empty until ticket 78) and `worker/migrations/blobs/`. A migration is a numbered `.sql` file, applied in order by `wrangler d1 migrations apply <binding>`, before the code that needs it.

**Add, then remove.** A migration only adds: a new table, a new nullable column. A column or table is dropped in a later deploy, once no deployed code reads it. A deploy that fails after its migration then leaves the running code working on the new schema. `wrangler rollback` brings back old code but never undoes a migration; D1 Time Travel does (`docs/operations.md`, restore).

The tests apply every migration before each Worker starts (`docs/testing.md`), so a broken one fails the suite.

## Variables and secrets

**Variables** are declared per environment in `wrangler.jsonc`: the Worker's name and script, the ids its watchdog filters by, the Google OAuth client id and the Turnstile site key (public, one of each for both Workers), every upload cap, the blob storage limit and every warn level. Change one there and deploy, or in the dashboard for a quick trial (a later deploy puts the file's value back). `keep_vars` keeps the variables that aren't in the file.

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

The steps that need the maintainer's login, card or judgment are in `scripts/backend-wizard.sh`, one phase per run (`h1` to `h6`; h6 is ticket 400's domain), in the order ticket 71 gives. It opens each dashboard, says what to click, sends each secret straight to Wrangler or GitHub, and writes the ids, site keys and hosts it collects (none secret) to `backend-handoff.local` (gitignored) for the agent.

## Adding a tester

Before the public release both Workers sit behind Cloudflare Access, which lets in only the emails its policies list, by a one-time PIN sent to that email (spec 385). To add a tester:

1. [one.dash.cloudflare.com](https://one.dash.cloudflare.com/) → Access controls → Applications.
2. Open the sign-in application of each host the tester needs (the one with an empty Path, not the `api/health` one), then its Allow policy.
3. Under Include → Emails, add the tester's address, and save. The policy is shared, so one edit can cover both hosts; check that both applications list it.
4. Send the tester the address. They type their email at the Access page and the PIN that arrives.

To remove a tester, delete the address the same way; their open session ends when it expires (24 hours by default), or at once by revoking their session in the Zero Trust dashboard's user list. Dev stays behind Access for good; production drops it at the public release (ticket 391).

## A fork's own copy

Nothing in the code names this account, so a fork deploys its own copy with its own accounts, all on free plans (spec 385):

1. **Cloudflare.** Its own account. Create the four D1 databases (`npx wrangler d1 create <name>`, a `core` and a `blobs` per Worker) and the two R2 buckets (`npx wrangler r2 bucket create <name>`).
2. **`wrangler.jsonc`.** For each environment: the Worker's `name` and `WORKER_SCRIPT`, `CF_ACCOUNT_ID`, each database's `database_name` and `database_id` (in `d1_databases` and in `CORE_DATABASE_ID` / `BLOBS_DATABASE_ID`), the bucket's `bucket_name`, and the fork's own `GOOGLE_CLIENT_ID` and `TURNSTILE_SITE_KEY`. Keep or tune the caps and warn levels.
3. **Outside services.** Its own Google OAuth client, Turnstile widget, Healthchecks.io checks, UptimeRobot monitors and Access applications. `scripts/backend-wizard.sh` walks each one; its phases work for any account.
4. **Secrets.** The four in the table above, per Worker, with `wrangler secret put`.
5. **GitHub.** A `production` environment limited to `main`, holding `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (and, for the backup, `HEALTHCHECK_BACKUP_URL` and `AGE_PUBLIC_KEY`). Without them the deploy workflow fails at its first Wrangler step and touches nothing. GitHub keeps a fork's workflows off until its Actions tab turns them on.
6. **First deploy.** By hand (above) or through the workflow; the smoke check reads the address from Wrangler, so nothing else names a host.
