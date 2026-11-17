# Deploy

How the app and its backend reach Cloudflare (ticket 71, spec 385, [ADR 0014](adr/0014-mvp-stays-local-only-hosted-phase-deferred.md)). What to watch once it runs, and when to switch a feature off or pay for more, is the runbook, `docs/operations.md` (private docs repo, linked in by `scripts/link-docs.sh`).

## What runs where

One Cloudflare account, on Workers Free, runs two Workers from one `wrangler.jsonc`:

| | dev | production |
|---|---|---|
| Worker | `bd-beads-dev` | `bd-beads` |
| Deployed | on every push to `main` | on the merge of a release commit, after dev; a manual run redeploys the newest release |
| Address | `https://dev.openbeads.com`, and `https://bd-beads-dev.bd4beads.workers.dev` | `https://openbeads.com`, and `https://bd-beads.bd4beads.workers.dev` until the release switches it off (ticket 391) |
| D1 `core` (binding `CORE`) | `bd-beads-dev-core` | `bd-beads-core` |
| D1 `blobs` (binding `BLOBS_DB`) | `bd-beads-dev-blobs` | `bd-beads-blobs` |
| R2 (binding `BLOBS`) | `bd-beads-dev` | `bd-beads` |
| Access | always | until the public release (ticket 391) |

Each Worker serves the built app and the Homepage as static assets at its root, and runs its code only for `/api/*` (`run_worker_first`), so loading the app never counts as a Worker request and keeps working when `/api` is over its daily cap or switched off. The code is `worker/` (`CODING_STANDARDS.md`). The two databases are apart so a full `blobs` can't stop sign-in ([ADR 0049](adr/0049-core-and-blobs-are-separate-d1-databases.md)).

## Deploying by hand

Needs `npx wrangler login` on the machine (wizard phase H2). From the repo root, after `npm ci`:

```sh
DEPLOY_BASE=/ npm run build
npx wrangler d1 migrations apply CORE --env dev --remote
npx wrangler d1 migrations apply BLOBS_DB --env dev --remote
npx wrangler deploy --env dev --var VERSION:$(git rev-parse HEAD)
curl -s https://bd-beads-dev.bd4beads.workers.dev/api/health   # or https://dev.openbeads.com/api/health
```

Production is the same with `--env production`, from a clean checkout of the newest release commit (`git checkout $(node scripts/release.ts production origin/main)`), never from `main`'s head. `npx wrangler deploy --dry-run --env <env>` checks the config and the bundle without touching Cloudflare.

## Deploying through GitHub

`.github/workflows/deploy.yml` does the same as the steps above; each Worker's deploy is `.github/workflows/deploy-worker.yml`, which it calls:

- **When it runs.** A push to `main` deploys dev. When the pushed commit is a release commit, production follows (Releasing to production, below). A manual run (Actions → Deploy → Run workflow, on `main`) redeploys production only. A run from any other ref fails at once, and the `production` environment refuses it too.
- **What it does.** One build, from `main`'s whole history (`fetch-depth: 0`), then for each Worker each database's migrations, then the code with `VERSION` set to the commit that was built, then a smoke check. The smoke check retries `/api/health` for up to two minutes, until it answers `ok` with that commit. It takes the address from Wrangler's own record of the deploy. A second check asks the custom domain (`dev.openbeads.com` or `openbeads.com`) the same; it sends the Access service token when `CF_ACCESS_CLIENT_ID` is set (ticket 395), and dev's is skipped with a warning until then. It is advisory: the zone's Bot Fight Mode challenges a runner, so a failure there only warns.
- **Custom domains.** Each Worker's `routes` entry in `wrangler.jsonc` is a Custom Domain, so a deploy keeps it. `PUBLIC_ORIGIN` is the origin sign-in is tried on; Google's callback and the allowed origins come from it, never from the request's host. Each hostname has its own Access application (ticket 400), so a tester is added to both policies.
- **Concurrency.** Dev and production each queue on their own: deploys of the same Worker run one behind another and are never cancelled halfway through. GitHub keeps only one waiting deploy per Worker, so a newer push replaces a dev deploy that is still waiting; if that was a release's, its production deploy doesn't run, and a manual run puts it there.
- **What it skips.** A push that changes only Markdown deploys nothing. A release always changes the release record, so it never skips.

## Releasing to production

Production holds only Production releases (spec 1043, ADR 0096). A release is a pull request that adds a release to the release record, `src/data/releases.json` (its shape is in `docs/agents/pull-requests.md`, Production releases); the commit its merge puts on `main` is a **release commit**. `scripts/release.ts` is the only place that knows which commit that is: `node scripts/release.ts is-release <commit>` says whether a commit adds a release, and `node scripts/release.ts production <ref>` names the commit production may get, the newest release commit on `<ref>`'s first-parent line (`main`'s head until a first release exists).

- **Making a release.** When the owner says "release", an agent runs `npm run release` on a branch from fresh `main` and opens the release PR (`docs/agents/pull-requests.md`, The release PR); the owner merges it.
- **A release reaches production by its merge.** The push builds once and deploys dev from it. Once dev's smoke check has passed, production is deployed from the same build and checked the same way. If dev fails, production is left as it was.
- **Production refuses any other commit.** Before any migration, production's job asks the script for the newest release commit on `main` as it is then, and fails if the build is of any other commit. So a deploy that waited behind a newer release can't put the older one back.
- **Redeploying a release.** A manual run (Actions → Deploy → Run workflow, on `main`) checks out the newest release commit, builds it, and deploys it to production; it never takes `main`'s head, and dev is untouched. Use it to repair production (a failed deploy, a release whose dev deploy was replaced, a dashboard change to undo). Going back to an older release is not a redeploy: it is a new release. Until a first release exists, a manual run deploys `main`'s head, as before releases; if `main` moves while it waits, it refuses, and a second run takes the new head.

## Migrations

Each database has its own folder: `worker/migrations/core/` (the day's count of Reports, ticket 1051; accounts come with ticket 78) and `worker/migrations/blobs/`. A migration is a numbered `.sql` file, applied in order by `wrangler d1 migrations apply <binding>`, before the code that needs it.

**Add, then remove.** A migration only adds: a new table, a new nullable column. A column or table is dropped in a later deploy, once no deployed code reads it. A deploy that fails after its migration then leaves the running code working on the new schema. `wrangler rollback` brings back old code but never undoes a migration; D1 Time Travel does (`docs/operations.md`, restore).

The tests apply every migration before each Worker starts (`docs/testing/worker.md`), so a broken one fails the suite.

## Variables and secrets

**Variables** are declared per environment in `wrangler.jsonc`: the Worker's name and script, the ids its watchdog filters by, the Google OAuth client id and the Turnstile site key (public, one of each for both Workers), `FEEDBACK_REPO` (the private docs repo a Report from the Feedback sheet becomes an issue in, ADR 0081), `FEEDBACK_DAILY_LIMIT` (the Reports a Worker takes per UTC day, ticket 1051), every upload cap, the blob storage limit and every warn level. Change one there and deploy, or in the dashboard for a quick trial (a later deploy puts the file's value back). `keep_vars` keeps the variables that aren't in the file.

**`DISABLED_FEATURES` is never in `wrangler.jsonc`.** It is the kill switch, set by hand in the dashboard (Workers → the Worker → Settings → Variables), comma-separated feature names (`worker/src/features.ts`). Because the file doesn't declare it, deploys leave it alone.

**Secrets** are never in the repo. Each is set per Worker with `npx wrangler secret put <NAME> --env <dev|production>`, which asks for the value hidden:

| Secret | What | Set in |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile's secret key | wizard H3c |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | wizard H3b |
| `HEALTHCHECK_URL` | this Worker's Healthchecks.io ping URL | wizard H3d |
| `CF_ANALYTICS_TOKEN` | read-only Account Analytics token, for the watchdog | wizard H3d |
| `GITHUB_TOKEN` | fine-grained GitHub token, Issues read and write on `FEEDBACK_REPO` only, one year; renewal dated in the runbook's weekly check | `scripts/wizard-feedback.sh` in the docs repo `czAAA/bd-beads-docs` |

GitHub holds only what CI needs, in the `production` environment (limited to `main`): the secret `CLOUDFLARE_API_TOKEN` (this account only, Workers Scripts edit and D1 edit), the variable `CLOUDFLARE_ACCOUNT_ID`, and for the backup the secret `HEALTHCHECK_BACKUP_URL` and the variable `AGE_PUBLIC_KEY`.

## The pages' security headers

Every page and file of the build is sent with `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin` (ticket 1024). No other site can show the app in a frame, and a script that got into a page can load nothing and send nothing outside the app's own origin.

- **Where they are set.** `vite.headers.ts` writes `dist/_headers` at the end of every build; Cloudflare's static assets read that file and send its headers with every page and file. Answers the Worker makes itself (`/api/*`) are not covered by it, so they set `nosniff` in code (`worker/src/errors.ts`).
- **Inline scripts need no step.** The pages' inline scripts (the theme, the Homepage's handoff) must run before first paint, so the policy names each by its hash. The hashes are taken from the built pages, so changing a script changes the policy with it.
- **Adding a source.** A script, frame, font, picture or API from another origin is refused until the policy names it: add it to `securityHeaders` in `vite.headers.ts` and to `vite.headers.test.ts`. Scripts never get `'unsafe-inline'` or `'unsafe-eval'`. Today the only other origin is `https://challenges.cloudflare.com` (Turnstile's script and frame).
- **Checked before deploy.** `vite preview` sends the same headers, so every browser check (`npm run visual`) runs under the policy; `e2e/visual/securityPolicy.spec.ts` says outright that it is in force.
- **Cloudflare features that add a script to the pages** (Rocket Loader, Web Analytics' automatic setup) are refused too. After switching one on for the zone, open dev with the browser's console: a line starting "Refused to" names what the policy stopped.
- **HTTP Strict Transport Security** is the zone's own setting, not this file's: SSL/TLS → Edge Certificates in the dashboard.

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
4. **Secrets.** The five in the table above, per Worker, with `wrangler secret put`.
5. **GitHub.** A `production` environment limited to `main`, holding `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (and, for the backup, `HEALTHCHECK_BACKUP_URL` and `AGE_PUBLIC_KEY`). Without them the deploy workflow fails at its first Wrangler step and touches nothing. GitHub keeps a fork's workflows off until its Actions tab turns them on.
6. **First deploy.** By hand (above) or through the workflow; the smoke check reads the address from Wrangler, so nothing else names a host.
