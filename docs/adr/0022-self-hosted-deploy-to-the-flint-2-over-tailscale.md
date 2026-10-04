# Hosting: a private build on the Flint 2 router, deployed by GitHub Actions over Tailscale

_Supersedes [ADR 0003](0003-github-pages-hosting.md)._

The repository is private and proprietary (ticket 64), and GitHub Pages on a private repository needs a paid plan; for now nothing paid is wanted. So the pre-release build is served from the owner's GL.iNet Flint 2 router: a `uhttpd` instance on `127.0.0.1:8088` serves `/mnt/sda1/www/` (ext4 on a USB stick), and `tailscale serve` exposes it, tailnet-only, at `https://tailnet-host.example:8444/bd-beads/`. HTTPS comes from Tailscale's certificate for the `.ts.net` name, which the camera and clipboard features need (secure context). The app is still a client-only SPA with no server ([ADR 0001](0001-local-only-persistence.md)); the router only serves static files.

## The deploy

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch, in two jobs:

1. **build**: `npm ci`, `npm run build`, and upload `dist/` as an artifact. The tests are not run again here: CI gates main (ticket 255), so this job only builds.
2. **deploy** (`needs: build`): the runner joins the tailnet as an ephemeral node tagged `tag:ci` (Tailscale GitHub Action, OAuth client), loads a dedicated deploy SSH key and a pinned `known_hosts`, and runs `rsync -rlt --delete` (with fixed file modes, so the runner's owner and permissions are not copied) of the artifact to the host. An unreachable router or a failed rsync fails the run. A `concurrency` group keeps deploys from overlapping.

Access is narrow on purpose. The Tailscale policy lets `tag:ci` reach only the router's SSH port (TCP 22); the OAuth client can only mint keys for `tag:ci`; the SSH key is used for nothing else and is stored, with the OAuth credentials, as GitHub Actions secrets. Host key checking is on, against the `DEPLOY_KNOWN_HOSTS` secret.

## Host-agnostic on purpose

The router is a stepping stone: the target may become a Raspberry Pi and, if the app gets popular, real hosting. Nothing host-specific is in the workflow. It reads:

| Kind | Name | Meaning |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | Host to SSH to (`tailnet-host.example`) |
| Variable | `DEPLOY_USER` | SSH user (`root`) |
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

Change the variables and secrets (host, user, path, base, host key, deploy key), point a web server with HTTPS at the target directory, and re-run the workflow. On a Pi on the same tailnet, that is all. On real hosting reachable from the internet, also remove the Tailscale join step; if it has no SSH/rsync, replace only the last step of the deploy job.

## Consequences

- GitHub Pages is off and its workflow is gone; anything that named the `github.io` URL now points at the router URL. It is reachable only from the tailnet, and from LAN devices that resolve the name (see the router notes).
- No paid service is involved: GitHub Actions on a private repository runs within the free minutes quota, and Tailscale's free tier covers the tailnet and the OAuth client.
- The site is only as available as the router and the USB stick, which is acceptable for a private pre-release build.
