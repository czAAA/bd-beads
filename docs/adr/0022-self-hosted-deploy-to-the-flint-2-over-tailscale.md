# Pre-release hosting: a build on the Flint 2 router, deployed by GitHub Actions over Tailscale

**Status: accepted for the pre-release build.** Tickets 64, 270. The public build goes to a Cloudflare Worker with the backend ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md), ticket 367), set up by ticket 71. Setup and moving host: `docs/deploy.md`.

The pre-release build is a static site on the owner's GL.iNet Flint 2 router: `uhttpd` serves it from a USB stick, and `tailscale serve` exposes it to the tailnet only, over HTTPS from Tailscale's certificate (the camera and clipboard need a secure context). The app is client-only ([ADR 0001](0001-local-only-persistence.md)), so the router only serves files. It costs nothing; the public release runs on the backend's host instead ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)).

- **`deploy.yml` builds and deploys every push to `main`**: one job builds `dist/`, the next joins the tailnet as an ephemeral `tag:ci` node and `rsync`s the build to the router over SSH. Tests are not its business; the pull request checks are (`docs/testing.md`).
- **Access is narrow**: `tag:ci` reaches only the router's SSH port, the OAuth client can mint only `tag:ci` keys, the SSH key does nothing else, and host keys are pinned. Secrets live in a `production` environment limited to `main`, so no other branch, pull request or fork can read them. The workflow's token is read-only, and its one third-party action is pinned to a commit SHA.
- **Nothing host-specific is in the workflow**: host, user, path, base path, keys and the Tailscale client come from the environment, and Vite's `base` comes from `DEPLOY_BASE` (default `/bd-beads/`). Moving host is changing those and, for a host on the internet, dropping the Tailscale step.
- The Overview ([ADR 0040](0040-the-overview-is-a-second-page.md)) is a folder with its own `index.html`, so the static host needs no rewrite rules.

**Considered options**: GitHub Pages (used first; left when the repository was private and Pages needed a paid plan, and not taken back: its terms rule out SaaS, and the public build goes to the backend's host); a manual deploy script (rejected: publishing must not depend on someone remembering a command).
