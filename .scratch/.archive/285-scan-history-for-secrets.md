# 285: Scan the full history for secrets and personal data

**What to build:** Before the repository goes public, prove that no secret was ever committed on any ref, and list everything personal or internal that would become public along with it. The output is a findings report that ticket 268 decides on.

**Blocked by:** None (can start immediately).

**Status:** done

Known so far (from a quick grep, not a real scan): the only `.env` files ever committed held a feature flag; the tailnet hostname `tailnet-host.example` appears in the README, ADR 0022, ticket 64 and their history; commits carry the author's full name and personal email (some with an empty email).

- [x] A real secret scanner (gitleaks or trufflehog) runs over every ref and every commit, including branches only on the remote and the open worktree branches; the exact command is recorded so it can be re-run just before the switch to public
- [x] Every finding is classified as a live secret, a revoked or dead secret, or a false positive; any live secret is rotated before this ticket closes, and the ticket says what was rotated
- [x] The report also lists what isn't a secret but would become public: hostnames and IPs, personal names and emails in commits, internal notes in tickets and agent files, and anything the `.gitignore` once missed
- [x] The report covers what lives on GitHub rather than in git: past Actions run logs and artifacts, PR titles, descriptions and comments, and the repository's variables (secrets themselves never become public)
- [x] The report is added to this ticket, ready for 268

## Report (for 268)

Run 2026-10-04 against `origin/main` at `a705a69`, repo `czAAA/bd-beads` (currently **private**).

### Secret scan

Tool: gitleaks 8.30.1 (`brew install gitleaks`). Re-run just before going public (also fetch first so remote-only branches are included):

```sh
git fetch --all --prune
gitleaks git --log-opts="--all -m" --redact -v .
```

Scope: all 15 local branches (including the open worktree branches and the three `worktree-agent-*` ones), all 135 remote-tracking refs, 617 commits reachable from any ref (522 non-merge, 95 merge). `--all` also covers tags and stash. Result for both the default run and the `-m` run (diffs of merge commits too): **no leaks found**. Nothing to classify, so there is **no live secret and nothing was rotated**.

Manual checks on top of the scanner:

- The only `.env` files ever committed are `.env` and `.env.development`; their whole content is `VITE_RICH_MIRROR=true|false` plus comments. No key, certificate or `id_rsa`-style file was ever committed.
- `.gitignore` has changed 7 times; no secret-bearing file was ever tracked, so it never "missed" anything that matters.
- No private-range IPs (10/8, 172.16/12, 192.168/16, Tailscale 100.64/10) and no `/Users/<name>` paths appear in any commit.

### Not secrets, but public once the repo is

| Item | Where | Count / detail |
| --- | --- | --- |
| Tailnet hostname `tailnet-host.example` (plus `root@` login in the ssh example) | `README.md`, `docs/adr/0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md`, `.scratch/64-repo-housekeeping.md` and its archived copy, tickets 270/285; in history of all of them | Only reachable from inside the tailnet, but it names the home server and the login user |
| Author identities | commit metadata | `Aliaksei <30803022+czAAA@users.noreply.github.com>` (212, GitHub web commits, already anonymous); `A B <30803022+czAAA@users.noreply.github.com>` (147) and `czAAA <30803022+czAAA@users.noreply.github.com>` (119): **personal Gmail**; `Aliaksei <30803022+czAAA@users.noreply.github.com>` (138): full name, empty email |
| Internal notes | `.scratch/` tickets and archive, `docs/agents/`, `CLAUDE.md`, `CONTEXT.md`, `.claude/settings.json`, ADRs | Working notes and agent setup; no credentials, but they describe the deploy setup and plans |
| GitHub Pages URL `czaaa.github.io/bd-beads` | README and others | Already public by design |

### On GitHub, not in git

- **Actions**: 591 workflow runs (CI 374, Deploy 124, "Deploy to GitHub Pages" 92, Measure 1) and 270 artifacts (`dist` 26, `visual-blob-*` ~58, `visual-check-report` 15, `visual-test-results-4` 1). Run logs become public with the repo. A sampled Deploy log prints `tailnet-host.example` 12 times; secret values appear only as `***`. Artifacts are app builds and visual-test images; none inspected for content beyond their names.
- **Variables** (visible to collaborators only, but they show up in run logs): `DEPLOY_BASE=/bd-beads/`, `DEPLOY_HOST=tailnet-host.example`, `DEPLOY_PATH=/mnt/sda1/www/bd-beads/`, `DEPLOY_USER=root`. Same hostname and `root` login as above.
- **Secrets** (names only, never public): `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`. Ticket 270 covers moving these behind a protected environment. Environment today: `github-pages` only.
- **PRs and issues**: 218 PRs, 0 issues, 2 issue/PR comments, 0 inline review comments, 0 reviews. Titles follow `type:[ticket] Description`; bodies were not read line by line.
- No webhooks and no deploy keys.

### For 268 to decide

1. Hostname and `root` login: in current files and all history. Scrubbing needs a history rewrite plus deleting old Actions runs (271 already lists that).
2. Personal Gmail and full name in commits: only a rewrite with a mailmap removes them.
3. Old Actions runs and artifacts: delete before going public regardless of the rewrite, since run logs keep the hostname.
