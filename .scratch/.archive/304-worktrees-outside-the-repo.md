# 304: Put ticket worktrees outside the repo

**What to build:** Change the implementing-tickets rule in `CLAUDE.md` so worktrees are created at `../bd-beads-<ticket>/`, a sibling of the repo, instead of `./bd-beads-<ticket>/` inside it. Inside the repo they showed up as untracked folders in `git status`. No user-facing change, so it is not added to the Overview or the Tour.

**Blocked by:** None

**Status:** done
