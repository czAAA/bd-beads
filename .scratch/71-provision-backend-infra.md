# 71: Provision the backend host and database

**What to build:** Set up the host and the managed storage that ticket 367 picked, ready for the backend to deploy to, so View links, accounts and sync have somewhere to run (ADR 0014). That is one Cloudflare Worker on Workers Free, serving the app and the Overview as static assets and the backend under `/api/*`, a D1 database for the records and an R2 bucket for the encrypted blobs. Workload, limits and prices: `docs/research/hosting.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [ ] A Cloudflare account exists (Workers Free), and the public domain is registered or pointed at it
- [ ] One Worker serves `dist/` as static assets at the domain's root (`DEPLOY_BASE=/`), and answers under `/api/*`, with that route set to fail closed
- [ ] A D1 database and an R2 bucket exist and are bound to that Worker only, with no public bucket access
- [ ] The database is backed up: D1 Time Travel is on (7 days on Free), plus a scheduled export to R2 for longer
- [ ] `deploy.yml` deploys the build to the Worker with `wrangler`, with its token in the `production` environment
- [ ] A request to the Worker is measured under the Free plan's 10 ms CPU limit
- [ ] `docs/deploy.md` says how to deploy the app and the backend, and when to move to Workers Paid (daily requests near the free cap, or the first Pro account)
- [ ] The ticket is archived in the same change
