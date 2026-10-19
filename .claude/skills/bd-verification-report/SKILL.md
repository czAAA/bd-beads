---
name: bd-verification-report
description: "Build a manual-verification checklist from the tickets and specs of every PR merged to main since the last report, then advance the stored pointer. Use when the user asks for a verification report, a checklist to verify what was delivered, or what changed since last check."
disable-model-invocation: true
---

Only a pointer and the output format are stored, never the report: `.scratch/.verification-pr` holds one number, the last PR already reported; `.scratch/.verification-format` holds `card` or `checklist` (docs repo, symlinked).

1. `git fetch -q origin`; `cat .scratch/.verification-pr`. Missing: ask the user for the starting PR. No format file: ask once, "card (markdown with `##` headings, for a card description) or checklist (plain lines, one per Trello checklist item)?", and save the answer.
2. New PRs: `git log origin/main --format='%h %s'`, keep those whose `(#N)` is above the pointer. Stacked PRs ("lands #143 on main") count by the `(#N)` of the commit on main. None: say so and stop.
3. Drop docs, glossary, skills and design-system-only PRs, and a PR that a later `Revert` commit undid (say so in a "not in this report" note). Group the rest by ticket: `[N]` in the title (`[0]`, `[none]`: no ticket, the title is all there is).
4. Check against the ticket, not the title. Per ticket N read only what matters: `grep -E '^(- \[|Left out|\*\*Spec|\*\*Superseded)' .scratch/000N-*.md` (archived: `.scratch/.archive/000N-*.md`, four digits), then the spec `docs/specs/NNNN-*.md` named in `**Spec:**`, if any. Read more of a ticket only when those lines aren't enough. Confirm in the PR (`gh pr view`, diff only where needed) that it was implemented.
5. Keep only the final behavior: if a later ticket replaced an earlier one's behavior (a "Superseded", "replaces", "removes" in its lines, or a later PR deleting the earlier control), check the later one only and list the earlier under "not in this report". One check per behavior, not per PR; several PRs of one ticket are one group.
6. Put unticked by-hand items ("Checked by hand", "[human]", "Left for a human", a real device) in a first section "Проверить руками" with the ticket number, then the rest by area.
7. Answer in the user's language. A check is "do X, see Y" with ticket and PR numbers in parentheses; requested-but-not-delivered items go in their own section. End with the newest PR covered and the oldest reported.
8. Format: `card` is markdown, `##` per area, `- [ ]` per check; `checklist` is plain lines, one check per line, no headings or prefix, one block per area with the area name above it. Every block is fenced so it copies cleanly. Over about 40 checks, split into one block per area group of at most 40 so each pastes on its own.
9. Show the report, then advance: write the newest merged PR number to the pointer and, in `../bd-beads-docs`, commit and push straight to `main`, with the code repo's `git config user.name`/`user.email` passed as `-c`, and `git pull --rebase` first. Not in the code repo, no PR.
