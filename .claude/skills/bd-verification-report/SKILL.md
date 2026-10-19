---
name: bd-verification-report
description: "Build a manual-verification checklist of every PR merged to main since the last report, then advance the stored pointer. Use when the user asks for a verification report, a checklist to verify what was delivered, or what changed since last check."
disable-model-invocation: true
---

Only a pointer is stored, never the report: `.scratch/.verification-pr` holds one number, the last PR already reported (docs repo, symlinked).

1. `git fetch -q origin`; read the pointer: `cat .scratch/.verification-pr`. Missing: ask the user for the starting PR.
2. List what's new: `git log origin/main --format='%h %s'` and keep commits whose `(#N)` has N greater than the pointer. None: say so and stop.
3. Skip docs, glossary, skills, revert pairs and refactors with no visible effect. Read a PR's diff (`gh pr view N`) only when its title can't be turned into a check.
4. Answer in the user's language, grouped by area, one `- [ ]` per observable check ("do X, see Y"), the PR number in parentheses. End with the newest PR covered and the oldest one reported.
5. Show the report, then advance: write the newest merged PR number to the pointer and commit and push straight to the docs repo's `main` (`git -C ../bd-beads-docs add -A && git -C ../bd-beads-docs commit -m "verification point #N" && git -C ../bd-beads-docs push`). Not in the code repo, no PR.
