# 270: Scope the deploy secrets to a protected environment

**What to build:** The Tailscale and SSH deploy secrets are reachable only from a deploy job running on `main`, never from a workflow on any other branch or from a fork. Today they are repository-wide secrets; that is safe only as long as no other workflow exists, and 272 adds one.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The deploy job runs in a `production` environment; the deploy secrets and variables are read from that environment, not from the repository
- [ ] The workflow's token keeps read-only permissions, and the third-party actions it uses are pinned to full commit SHAs
- [ ] ADR 0022 and the README's deploy section describe the one-time GitHub setup: create `production`, limit its deployment branches to `main`, move `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and the `DEPLOY_*` variables into it, then delete the repository-level copies
- [ ] Human: environment created and secrets moved, then a manual deploy run succeeds
