# 226: Implementing-tickets rule in CLAUDE.md

**What to build:** A standing rule in `CLAUDE.md` so agents implementing a ticket (including via the `implement` skill) always follow the same workflow without being told each time: branch from fresh `origin/main`, using a worktree at `./bd-beads-<ticket>/` when the current branch isn't `main`; archive the ticket in the same change; commit, push and open the PR when done. No user-facing change, so it is not added to the Overview or the Tour.

**Blocked by:** None

**Status:** done
