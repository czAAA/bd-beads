---
name: bd-conflicts
description: "Use when a branch or its PR conflicts with main, or a git merge/rebase conflict is in progress. Resolves without losing functionality, verifies with checks and tests, then updates the PR."
---

1. **Start from a safe state.** Work in the branch's worktree (`git worktree list`; a ticket's is `../bd-beads-worktrees/bd-beads-<ticket>/`). On `main`, stop: there is nothing to resolve. If a merge/rebase is already in progress, skip to step 2. Otherwise check that the work is committed and pushed: `git status` is clean and `git log @{u}..HEAD` is empty (no upstream: stop and say so). If not, stop and tell the user what is uncommitted or unpushed. Then `git fetch origin main` and `git merge origin/main` into the current branch, so the conflicts land on this branch's PR (`gh pr view`). Merge, don't rebase: no force-push.

2. **See the conflicts.** List the conflicting files and read the history on both sides.

3. **Find the primary sources** for each conflict: why each change was made and its original intent. Read the commit messages, the PRs, the tickets (`.scratch/`, and `.scratch/.archive/` by `ls`). Note whether this branch's goal is to **refactor, replace, remove or rework** the code in conflict.

4. **Resolve each hunk, losing no functionality.**
   - Keep both sides' behaviour. Anything main added or fixed must survive in the result.
   - The only exception: this branch's goal is to refactor, replace, remove or rework exactly that code. Then this branch wins for that hunk, and main's change is carried into the new form where it still applies.
   - Don't invent new behaviour. Always resolve; never `--abort`.
   - Keep a list of every hunk where one side was dropped or reshaped, with the reason.

5. **Verify before touching the PR.** Run `npm run check` and `npm run test:related -- <files changed by the merge, plus the conflicted files>`. Fix anything the merge broke, at the merge, not by weakening tests. If a failure can't be fixed without losing functionality, stop and report; don't push.

6. **Finish and update the PR.** Stage everything, commit the merge (or continue the rebase to the end), and push only when step 5 is green. If a rebase was in progress, ask before force-pushing, and use `--force-with-lease`. Report the dropped-or-reshaped list from step 4.
