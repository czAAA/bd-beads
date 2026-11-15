---
name: bd-worktree
description: "Set up the worktree a piece of work happens in, and remove the stale ones. Use before starting any implementation (bd-implement and bd-implement-bulk start here), right after a PR merges, and when asked to clean up worktrees or free disk space."
---

Every piece of work gets its own worktree, and the worktree goes once its PR is merged. One worktree is about 620 MB, nearly all `node_modules`: left behind, they fill the disk and every session stops.

## 1. Clean up

Run `bash scripts/worktree-prune.sh` before creating a worktree, right after a PR merges, and whenever asked to clean up. Don't ask first and don't hesitate: it removes only what is safe to lose.

It removes a worktree and its local branch when all of these hold:

- its branch has a merged PR and no open one;
- nothing was committed there after the merge;
- it holds no uncommitted or untracked file;
- no process runs from inside it (a tailnet server left serving a merged branch is stopped first).

Everything else it keeps and names with the reason: no PR, an open PR, a PR closed without merging, work that was never committed or pushed, a process still running there. Rules for what it keeps:

- Never remove a kept worktree yourself: no `git worktree remove --force`, no `rm -rf`. The reason it was kept is work that exists nowhere else. Pass the kept list and the reasons on to the user in your final message.
- A cleanup that fails (no network, `gh` not signed in) removes nothing and never blocks the work: go on, and say that cleanup didn't run.
- `--dry-run` prints what would go without removing anything. Use it only when the user asks what is stale.
- As a sub-agent of a bulk run, skip this step: the orchestrator cleans up, and several sub-agents removing worktrees at once would collide.

## 2. Create

From the main checkout:

1. `git fetch origin main`
2. `git worktree add -b <type>/<ticket>-<slug> ../bd-beads-worktrees/bd-beads-<ticket> origin/main`, with `type` one of `feat`, `fix`, `ref` (the PR headline's type) and `slug` a few words in kebab case. Work without a ticket is named by its slug alone: `ref/<slug>` in `bd-beads-<slug>`.
3. In the new worktree: `bash scripts/link-docs.sh` (links the private docs repo in; if that repo isn't cloned, go on without it), then `npm ci` (a fresh worktree has no `node_modules`, and nothing runs without them).
4. Work only there: every edit, command and commit. The main checkout stays on `main`, untouched.

Rules:

- **Where.** Always under `../bd-beads-worktrees/`: never inside the repo and never directly beside it, so that folder can be wiped without touching the docs repo.
- **From what.** Always from `origin/main`, never from another unmerged branch: its squash merge conflicts with your copy of its commits.
- **One per ticket.** If the ticket already has a worktree (`git worktree list | grep bd-beads-<ticket>`), resume there instead of creating a second one: read `git status` and `git log origin/main..HEAD` first.
