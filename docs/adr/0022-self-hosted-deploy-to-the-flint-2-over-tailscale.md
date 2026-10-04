# Hosting: a private build on the Flint 2 router, deployed by GitHub Actions over Tailscale

_Supersedes [ADR 0003](0003-github-pages-hosting.md). Its "private and proprietary" framing below is superseded by [ADR 0031](0031-public-agpl-3-license.md) (ticket 269); the hosting choice itself stands. The deploy secrets and variables moved from the repository into a `production` environment in ticket 270, once a second workflow existed that could otherwise have reached them._

The repository was private and proprietary (ticket 64), and GitHub Pages on a private repository needs a paid plan; for now nothing paid is wanted. So the pre-release build is served from the owner's GL.iNet Flint 2 router: a `uhttpd` instance on `127.0.0.1:8088` serves `/mnt/sda1/www/` (ext4 on a USB stick), and `tailscale serve` exposes it, tailnet-only, at `https://tailnet-host.example:8444/bd-beads/`. HTTPS comes from Tailscale's certificate for the `.ts.net` name, which the camera and clipboard features need (secure context). The app is still a client-only SPA with no server ([ADR 0001](0001-local-only-persistence.md)); the router only serves static files.

## The deploy

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch, in two jobs:

1. **build**: `npm ci`, `npm run build`, and upload `dist/` as an artifact. The tests are not run here: they run on the developer's machine before a push (ADR 0029), so this job only builds.
2. **deploy** (`needs: build`): the runner joins the tailnet as an ephemeral node tagged `tag:ci` (Tailscale GitHub Action, OAuth client), loads a dedicated deploy SSH key and a pinned `known_hosts`, and runs `rsync -rlt --delete` (with fixed file modes, so the runner's owner and permissions are not copied) of the artifact to the host. An unreachable router or a failed rsync fails the run. A `concurrency` group keeps deploys from overlapping.

Access is narrow on purpose. The Tailscale policy lets `tag:ci` reach only the router's SSH port (TCP 22); the OAuth client can only mint keys for `tag:ci`; the SSH key is used for nothing else and is stored, with the OAuth credentials, as GitHub Actions secrets. Host key checking is on, against the `DEPLOY_KNOWN_HOSTS` secret. All of it is scoped to the `production` environment (below), so only the `deploy` job running on `main` can read it; a workflow on another branch, a pull request, or a fork cannot.

## Scoped to a `production` environment

Both jobs declare `environment: production`, so their secrets and variables come from that environment, not from the repository — `build` needs `DEPLOY_BASE` for the Vite build, `deploy` needs the rest. The environment's deployment branches are limited to `main`, so even a `workflow_dispatch` run from another branch cannot read them.

The workflow's token keeps the repository-wide `permissions: contents: read` (no write scope anywhere), and the one third-party action it runs, `tailscale/github-action`, is pinned to a full commit SHA rather than a tag, so a tag move upstream can't change what CI runs.

**One-time GitHub setup** (Settings → Environments):

1. Create an environment named `production`.
2. Under "Deployment branches and tags", restrict it to the `main` branch.
3. Add `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` as environment secrets, and `DEPLOY_PATH`, `DEPLOY_BASE` as environment variables, with the same values the repository-level copies had.
4. Delete the repository-level secrets and variables of the same names (Settings → Secrets and variables → Actions).
5. Run the workflow by hand (Actions tab → "Run workflow") to confirm the deploy still succeeds from the environment.

## Host-agnostic on purpose

The router is a stepping stone: the target may become a Raspberry Pi and, if the app gets popular, real hosting. Nothing host-specific is in the workflow. It reads, all from the `production` environment:

| Kind | Name | Meaning |
| --- | --- | --- |
| Secret | `DEPLOY_HOST` | Host to SSH to. A secret, not a variable, so public run logs show `***` |
| Secret | `DEPLOY_USER` | SSH user. A secret for the same reason |
| Variable | `DEPLOY_PATH` | Target directory, with a trailing slash (`/mnt/sda1/www/bd-beads/`) |
| Variable | `DEPLOY_BASE` | URL path the app is served from (`/bd-beads/`) |
| Secret | `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` | Deploy key and pinned host key |
| Secret | `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | Tailscale OAuth client for `tag:ci` |

**`base` is configurable.** `vite.config.ts` takes the production `base` from `DEPLOY_BASE` (`vite.base.ts`, tested in `vite.base.test.ts`), defaulting to `/bd-beads/`, adding missing leading and trailing slashes; the dev server stays at `/`. It is not hardcoded any more because a new host may serve the app from a different subpath or from the domain root. The e2e server (`e2e/support/server.ts`) assumes the default, so don't set `DEPLOY_BASE` when running the browser checks locally.

## Assumptions that change on a new host

- **Tailscale reachability.** The router is not on the internet, so CI joins the tailnet to reach it. A host with a public address needs no tailnet step (drop the Tailscale step and the `tag:ci` policy); a Raspberry Pi at home still does.
- **rsync over SSH.** The target needs `rsync` installed (`opkg install rsync` on the router) and an SSH server accepting the deploy key (dropbear here: `/etc/dropbear/authorized_keys`). Managed hosting that has no SSH would need that step replaced by its own upload; the build job and artifact stay the same.
- **`base` path.** Set `DEPLOY_BASE` to wherever the new host serves the app, and `DEPLOY_PATH` to match its web root.
- **HTTPS termination.** Here `tailscale serve` terminates TLS in front of `uhttpd`. A new host must provide HTTPS itself (Caddy or nginx with a certificate, or the provider's), because camera and clipboard need a secure context.

## Moving to a Raspberry Pi or real hosting

Change the variables and secrets (host, user, path, base, host key, deploy key) in the `production` environment, point a web server with HTTPS at the target directory, and re-run the workflow. On a Pi on the same tailnet, that is all. On real hosting reachable from the internet, also remove the Tailscale join step; if it has no SSH/rsync, replace only the last step of the deploy job.

## Consequences

- GitHub Pages is off and its workflow is gone; anything that named the `github.io` URL now points at the router URL. It is reachable only from the tailnet, and from LAN devices that resolve the name (see the router notes).
- No paid service is involved: GitHub Actions on a private repository runs within the free minutes quota, and Tailscale's free tier covers the tailnet and the OAuth client.
- The site is only as available as the router and the USB stick, which is acceptable for a private pre-release build.
