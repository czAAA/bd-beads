# Deploy

How the pre-release build reaches the Flint 2 router, and how to move it. Why it is set up this way: [ADR 0022](adr/0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md).

## The router

A `uhttpd` instance on `127.0.0.1:8088` serves `/mnt/sda1/www/` (ext4 on a USB stick), and `tailscale serve` exposes it, tailnet-only, at `https://tailnet-host.example:8444/bd-beads/`. HTTPS comes from Tailscale's certificate for the `.ts.net` name. It is reachable from the tailnet, and from LAN devices that resolve the name.

## The workflow

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch, and ignores pushes that change only `.scratch/` or Markdown.

1. **build**: `npm ci`, `npm run build` (which runs `vue-tsc -b`, so a type error can't ship), and upload `dist/` as an artifact.
2. **deploy** (`needs: build`): join the tailnet as an ephemeral node tagged `tag:ci` (Tailscale GitHub Action, OAuth client), load the deploy SSH key and the pinned `known_hosts`, and run `rsync -rlt --delete` with fixed file modes to the host. An unreachable router or a failed rsync fails the run. A `concurrency` group keeps deploys from overlapping.

The Tailscale policy lets `tag:ci` reach only the router's TCP 22. The router needs `rsync` (`opkg install rsync`) and accepts the key through dropbear (`/etc/dropbear/authorized_keys`).

## Settings (the `production` environment)

| Kind | Name | Meaning |
| --- | --- | --- |
| Secret | `DEPLOY_HOST` | Host to SSH to. A secret, not a variable, so public run logs show `***` |
| Secret | `DEPLOY_USER` | SSH user, a secret for the same reason |
| Variable | `DEPLOY_PATH` | Target directory, with a trailing slash (`/mnt/sda1/www/bd-beads/`) |
| Variable | `DEPLOY_BASE` | URL path the app is served from (`/bd-beads/`) |
| Secret | `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` | Deploy key and pinned host key |
| Secret | `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | Tailscale OAuth client for `tag:ci` |

`vite.config.ts` takes the production `base` from `DEPLOY_BASE` (`vite.base.ts`, tested in `vite.base.test.ts`), adding missing slashes; the dev server stays at `/`. The e2e server (`e2e/support/server.ts`) assumes the default, so don't set `DEPLOY_BASE` when running the browser checks locally.

## One-time GitHub setup

1. Settings → Environments: create `production`.
2. Under "Deployment branches and tags", restrict it to `main`.
3. Add the secrets and variables above.
4. Run the workflow by hand (Actions → "Run workflow") to confirm the deploy succeeds.

## Moving host

- **Same tailnet** (a Raspberry Pi at home): change host, user, path, base, host key and deploy key in `production`, point a web server with HTTPS at the target directory, and re-run the workflow.
- **On the internet**: also remove the Tailscale step and the `tag:ci` policy. The host must provide HTTPS itself (Caddy or nginx with a certificate, or the provider's), because camera and clipboard need a secure context.
- **No SSH** (managed static hosting): replace only the deploy job's last step with the provider's upload; the build job and artifact stay.
