# 64: Repo housekeeping: private repo + proprietary notice

**What to build:** Two parts. (1) Make the `czAAA/bd-beads` GitHub repository private, and add an explicit proprietary copyright notice to the repo (no open-source license), so the codebase's legal status is stated rather than left to default, unstated all-rights-reserved copyright, ahead of releasing this as a paid product (see ADR 0014). (2) Once the repo is private, replace the GitHub Pages deploy with an automated deploy to the owner's Flint 2 router, reachable only over Tailscale, so the private pre-release build stays hosted.

## Part 2: automated deploy to the Flint 2

The router side is already set up by hand (not part of this ticket): a `uhttpd` instance on `127.0.0.1:8088` serves `/mnt/sda1/www/` (ext4 USB stick), and `tailscale serve` exposes it tailnet-only at `https://tailnet-host.example:8444/bd-beads/`. This ticket is what is left: getting the built `dist/` into `/mnt/sda1/www/bd-beads/` from GitHub Actions.

Constraint: no paid services for now. GitHub Actions and Tailscale both have free tiers that cover this (GitHub Actions runs on private repos within the free minutes quota; only GitHub Pages on a private repo needs a paid plan), so the deploy stays on GitHub Actions.

Shape of the solution:

- A GitHub Actions job builds the app and pushes `dist/` to the router over SSH (`rsync --delete`, into `/mnt/sda1/www/bd-beads/`).
- The runner joins the tailnet as an ephemeral node (Tailscale GitHub Action, OAuth client, `tag:ci`), since the router is not reachable from the internet.
- A dedicated deploy SSH key (public half in the router's `/etc/dropbear/authorized_keys`), private half and Tailscale OAuth credentials stored as GitHub Actions secrets.
- Tailscale ACL: `tag:ci` may reach only the router's SSH port.
- The router needs `rsync` (`opkg install rsync`).
- `vite.config.ts` hardcodes `base: '/bd-beads/'` for production, which happens to match the router path; keep it working for both, and decide whether `base` needs to become configurable if Pages is dropped or kept.
- GitHub Pages is already turned off in the repo settings, so `.github/workflows/deploy.yml` (the Pages deploy) is replaced by the router deploy.
- The router is a stepping stone: the target may become a Raspberry Pi server, and later real hosting if the app gets popular. Keep the deploy host-agnostic so a move is a config change, not a rewrite: the host, SSH user, target path, and base path come from GitHub Actions variables/secrets rather than being hardcoded in the workflow, and the build/deploy steps are separate (the build artifact is the same whichever target receives it). Record the assumptions that would change on a new host (Tailscale reachability, rsync over SSH, `base` path, HTTPS termination) in the ADR below.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## How the session works

The agent does everything that is code, docs or a command on this machine. The human does what needs an account login, an admin console, a secret value, or a shell on the router. Every human step is marked **[HUMAN]** below; the agent must stop at each one, say exactly what to do (with copy-paste commands or click paths), and wait for confirmation before continuing. Commands to run in the session can be given as `! <command>`. The agent never handles private key material or secret values itself: the human generates them and pastes them into GitHub.

Order matters: prove the manual path first, then automate it.

### A. Repo housekeeping (no dependencies)

1. **[AGENT]** Add the proprietary all-rights-reserved notice (`LICENSE` or `COPYRIGHT` at the repo root, plus the `package.json` `license` field set to `UNLICENSED`) and adjust `README.md` so it no longer implies an open, contribution-welcome posture.
2. **[HUMAN]** After the PR is merged: GitHub → repo Settings → General → Danger Zone → Change visibility → Private. (Pages is already off.) Confirm to the agent.

### B. Router prerequisites (manual path first)

3. **[HUMAN]** SSH into the router and run `opkg update && opkg install rsync`. Paste the output so the agent can confirm.
4. **[AGENT]** Give the exact commands to create a dedicated deploy key on the human's PC (`ssh-keygen -t ed25519 -f ~/.ssh/flint2_deploy -C bd-beads-deploy`, no passphrase because CI uses it) and to authorise it on the router (append the `.pub` line to `/etc/dropbear/authorized_keys`, check permissions).
5. **[HUMAN]** Run those commands. Confirm `ssh -i ~/.ssh/flint2_deploy root@tailnet-host.example true` works over Tailscale (note: dropbear on OpenWrt may listen on the LAN only; if it does not answer on the tailnet address, the agent proposes the fix, e.g. the `dropbear` `Interface` option, and the human applies it on the router).
6. **[AGENT]** Run `npm run build` and give the human the `rsync -av --delete dist/ root@<router>:/mnt/sda1/www/bd-beads/` command (or run it if SSH from this machine works and the human approves).
7. **[HUMAN]** Open `https://tailnet-host.example:8444/bd-beads/` in a browser on the tailnet and confirm the app loads, assets resolve, and camera/clipboard work (HTTPS secure context). Report back.

### C. Tailscale for CI

8. **[HUMAN]** Tailscale admin console → Access controls: add `tagOwners` for `tag:ci` and an ACL/grant letting `tag:ci` reach only the router's SSH port (22). The agent supplies the exact policy JSON snippet to paste.
9. **[HUMAN]** Admin console → Settings → OAuth clients: create a client with the `auth_keys` write scope limited to `tag:ci`. Keep the client ID and secret for the next step.
10. **[HUMAN]** GitHub → repo Settings → Secrets and variables → Actions. Secrets: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY` (contents of the private key file), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan` for the router, checked against the known fingerprint). Variables: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_BASE`. The agent gives the list with the values to use; the human enters them. Confirm when done.

### D. Automation

11. **[AGENT]** Make the production `base` come from `DEPLOY_BASE` (default `/bd-beads/`) in `vite.config.ts`, with a test or check that the build honours it, and record the `base` decision.
12. **[AGENT]** Replace `.github/workflows/deploy.yml` with a workflow that runs on push to `main` and `workflow_dispatch`: test and build job, then a deploy job (`needs: build`) that joins the tailnet as `tag:ci` (Tailscale action), loads the SSH key and known_hosts, and runs `rsync --delete` to `${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}`. Everything host-specific comes from variables/secrets. A failed test or an unreachable router fails the run. Use a `concurrency` group so deploys never overlap.
13. **[HUMAN]** Merge the PR, then watch the first run in the Actions tab (or trigger it with "Run workflow"). If it fails, paste the log to the agent; fixing secrets or ACL problems is the human's, workflow fixes are the agent's.
14. **[HUMAN]** Reload the app URL in a browser and confirm the new build is live (e.g. the agent adds a visible change or the human checks the asset hashes changed).

### E. Docs

15. **[AGENT]** Update every doc that describes the hosting: `README.md`, a new ADR for the self-hosted deploy that supersedes `docs/adr/0003-github-pages-hosting.md` (keep 0003 as history, mark it superseded), the `base` comment in `vite.config.ts`, and `CONTEXT.md` if it mentions hosting. The ADR records the assumptions that change on a new host (Tailscale reachability, rsync over SSH, `base` path, HTTPS termination), with a short "moving to a Raspberry Pi / real hosting" section. Re-grep for "GitHub Pages" and stale URLs at the end.
16. **[AGENT]** Extend `docs/personal/flint2-hosting-notes.md` (local only, not committed) with everything done in sections A to D, as learning notes in the same style as the existing sections: exact commands, what each command and flag does, why it was chosen, problems hit and how they were fixed, anything tried and rolled back. Update or remove its "Still to do" list. The human reads it at the end.
17. **[HUMAN]** Review the notes and the PR, then close the ticket (move it to `.scratch/.archive/`).

## Acceptance

- [ ] Repository is private and carries a proprietary notice; README no longer reads as open source
- [ ] `rsync` installed on the router, deploy key authorised, first manual deploy verified in a browser over Tailscale
- [ ] Tailscale `tag:ci` ACL and OAuth client in place; secrets and variables stored in GitHub Actions
- [ ] Push to `main` builds and deploys to the router; a failed test or unreachable router fails the run
- [ ] Deploy target and `base` come from variables/secrets, so a move to a Raspberry Pi or real hosting needs no workflow rewrite
- [ ] Pages workflow replaced; hosting docs and ADR updated; no stale "GitHub Pages" references
- [ ] `docs/personal/flint2-hosting-notes.md` extended as described in step 16
