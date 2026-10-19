---
name: bd-verification-report
description: "Build a manual-verification checklist from the tickets and specs of every PR merged to main since the last report, then advance the stored pointer. Use when the user asks for a verification report, a checklist to verify what was delivered, or what changed since last check."
disable-model-invocation: true
---

Only a pointer is stored, never the report: `.scratch/.verification-pr` holds one number, the last PR already reported (docs repo, symlinked).

1. `git fetch -q origin`; read the pointer: `cat .scratch/.verification-pr`. Missing: ask the user for the starting PR.
2. List what's new: `git log origin/main --format='%h %s'` and keep commits whose `(#N)` has N greater than the pointer. None: say so and stop.
3. Skip docs, glossary, skills and revert pairs. Group the rest by ticket: `[N]` in the title (`[0]`, `[none]`: no ticket, the title is all there is).
4. Check against the ticket, not the title. Per ticket N, read `.scratch/000N-*.md` or, if archived, `cat .scratch/.archive/000N-*.md` (four digits), then its `**Spec:**` file `docs/specs/NNNN-*.md` if any. Take what was requested and every acceptance box, including what the ticket says was left out. Confirm against the PR (`gh pr view`, diff only where needed) that it was implemented. One check per requested behavior, not per PR. Several PRs of one ticket become one group.
5. Answer in the user's language, grouped by area, one `- [ ]` per observable check ("do X, see Y"), ticket and PR numbers in parentheses. Flag requested but not delivered items separately. End with the newest PR covered and the oldest one reported. Put the whole report in one fenced ```markdown block (headings as `##`, items as `- [ ]`) so it pastes straight into Trello.
6. Show the report, then advance: write the newest merged PR number to the pointer and commit and push straight to the docs repo's `main` (`git -C ../bd-beads-docs add -A && git -C ../bd-beads-docs commit -m "verification point #N" && git -C ../bd-beads-docs push`). Not in the code repo, no PR.
