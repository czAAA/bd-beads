# 270: Scope the deploy secrets to a protected environment

**What to build:** The Tailscale and SSH deploy secrets are reachable only from a deploy job running on `main`, never from a workflow on any other branch or from a fork. Today they are repository-wide secrets; that is safe only as long as no other workflow exists, and 272 adds one.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The deploy job runs in a `production` environment; the deploy secrets and variables are read from that environment, not from the repository
- [x] The workflow's token keeps read-only permissions, and the third-party actions it uses are pinned to full commit SHAs
- [x] ADR 0022 and the README's deploy section describe the one-time GitHub setup: create `production`, limit its deployment branches to `main`, move `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and the `DEPLOY_*` variables into it, then delete the repository-level copies
- [ ] Human: environment created and secrets moved, then a manual deploy run succeeds

Also moved `DEPLOY_HOST` and `DEPLOY_USER` into the `production` environment, beyond what this checklist named: they were already deploy secrets (per ADR 0022's table) read via `secrets.*` in the workflow, so leaving them at the repository level would have defeated the ticket's purpose. The `build` job also had to declare `environment: production` (not just `deploy`), since it reads `vars.DEPLOY_BASE` for the Vite build — without that, `DEPLOY_BASE` would have silently gone empty once the repository-level copy is deleted.
