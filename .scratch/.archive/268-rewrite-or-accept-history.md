# 268: Decide on the history: rewrite or accept

**What to build:** Using 285's report, decide what in the git history may become public as it is. Then either accept it or rewrite the history before anything else lands, so the public repository starts from history you're happy to publish.

**Blocked by:** 285 (Scan the full history for secrets and personal data).

**Status:** done

A rewrite changes every commit SHA: open branches, PRs and the `bd-beads-*` worktrees have to be finished or rebuilt first, and everyone with a clone has to re-clone. After the repository is public, a rewrite no longer helps, because forks and caches keep the old history.

- [x] Decided for each item in 285's report: the tailnet hostname, the author name and email, and anything else flagged. Accept it, or remove it from the history
- [x] If any item is removed: open branches and worktrees are merged or abandoned first, the history is rewritten (e.g. `git filter-repo` with a mailmap and a replace-text list), force-pushed, and 285's scan re-run clean
- [x] If the hostname stays: it's confirmed that the tailnet host is reachable only to tailnet members, so publishing its name exposes nothing usable
- [x] Future commits use the GitHub noreply email if the personal email should no longer appear
- [x] The decision is recorded in this ticket

## Decision

Rewrite, into a new repository. Decided 2026-10-04 after 285's report found no secrets but did find personal data.

- **Removed from history:** the personal Gmail address and the full legal name (commit metadata, `Co-authored-by` trailers and file contents), and the tailnet hostname. Every commit is now `Aliaksei <30803022+czAAA@users.noreply.github.com>`; GitHub web merges keep the `GitHub` committer.
- **How:** `git filter-repo` over a single-branch clone of `main` with a replace-text list (also applied to messages) and a commit callback for the identities; gitleaks re-run over the result: no leaks. Only `main` was carried over: the squash-merged PRs make the other branches redundant.
- **Why a new repository and not a force-push:** GitHub keeps the old commits reachable through `refs/pull/*`, and the Actions run logs print the hostname. The old repository was renamed `bd-beads_private` and stays private as a backup; the rewritten history lives in a fresh `bd-beads`, which also starts without the old runs and artifacts (271).
- **Hostname in the workflow:** `DEPLOY_HOST` and `DEPLOY_USER` are now secrets, so run logs show `***` instead of the host and login.
- **Future commits** use the GitHub noreply email (`git config user.email 30803022+czAAA@users.noreply.github.com`) on every machine.
