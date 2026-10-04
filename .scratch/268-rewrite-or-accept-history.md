# 268: Decide on the history: rewrite or accept

**What to build:** Using 267's report, decide what in the git history may become public as it is. Then either accept it or rewrite the history before anything else lands, so the public repository starts from history you're happy to publish.

**Blocked by:** 267 (Scan the full history for secrets and personal data).

**Status:** ready-for-human

A rewrite changes every commit SHA: open branches, PRs and the `bd-beads-*` worktrees have to be finished or rebuilt first, and everyone with a clone has to re-clone. After the repository is public, a rewrite no longer helps, because forks and caches keep the old history.

- [ ] Decided for each item in 267's report: the tailnet hostname, the author name and email, and anything else flagged. Accept it, or remove it from the history
- [ ] If any item is removed: open branches and worktrees are merged or abandoned first, the history is rewritten (e.g. `git filter-repo` with a mailmap and a replace-text list), force-pushed, and 267's scan re-run clean
- [ ] If the hostname stays: it's confirmed that the tailnet host is reachable only to tailnet members, so publishing its name exposes nothing usable
- [ ] Future commits use the GitHub noreply email if the personal email should no longer appear
- [ ] The decision is recorded in this ticket
