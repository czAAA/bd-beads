# Issue tracker

Issues are tracked as markdown files under `.scratch/`, one flat file per ticket, named `NNNN-slug.md`, the number zero-padded to four digits so file lists sort in order (e.g. `0052-vocabulary-alignment.md`). `.scratch/` is a symlink into the private docs repo `bd-beads-docs`, cloned next to this one and linked by `scripts/link-docs.sh` (README, "Where the docs live"); the code repo never tracks it:

```
.scratch/
  0052-vocabulary-alignment.md
  0053-ci-gate.md
  .archive/
    0051-move-new-pattern-cta-and-zoom-controls.md
```

- `.archive/` holds resolved tickets, moved there once closed.
- Tickets stay flat: every open ticket is `.scratch/NNNN-slug.md`, never in a per-feature or per-epic folder. The slug is a few lowercase words, hyphenated.

## Ticket numbers

A new ticket takes the highest number in use plus one, counted across `.scratch/` and `.scratch/.archive/`. Tickets are committed straight to the docs repo's `main` (no branch), so one folder holds every number in use:

```sh
ls .scratch .scratch/.archive | grep -oE '^[0-9]+-' | grep -oE '[0-9]+' | sort -n | tail -1
```

Write the next number with four digits (`printf '%04d'`). Numbers in text ("ticket 0071", "Blocked by: 0071") are padded the same way.

Pull the docs repo first (`git -C ../bd-beads-docs pull`).

A number is never reused, and a ticket keeps its number when it moves to `.archive/`.

Specs are not tickets: a spec is kept in `docs/specs/` (`NNNN-<slug>.md`, same number as when it was written), never in `.scratch/` or its archive, so it is not archived with the tickets that implement it.

## Ticket format

```markdown
# NNNN: Title, saying the outcome in the user's words

**What to build:** what changes for the person using the app, and why. Cause and known limits, if found, follow as paragraphs.

**Spec:** NNNN (the spec this one implements, a file `docs/specs/NNNN-*.md`), if any

**Blocked by:** None (can start immediately) | NNNN, NNNN (what each one brings)

**Status:** needs-triage

- [ ] One checkable outcome per line
- [ ] ...
- [ ] The ticket is archived in the docs repo and pushed
```

- `**Status:**` holds exactly one triage label (`docs/agents/triage-labels.md`); a ticket with a branch or worktree being worked on is at least `ready-for-agent` or `ready-for-human`, never `needs-triage`.
- Sections a larger ticket may add under the checklist: `### <group>` headings to split the checklist, and `### Done when` for the checks that close it.
- On closing, tick every box that was done, say in the ticket what was left out and why, set `**Status:** done`, and move the file to `.archive/` in the docs repo, committed and pushed at once. Closing happens when the PR that completes the ticket is open and ready for review, not at the merge; a PR that is one step of a larger ticket doesn't close it. If review finds something wrong or missing, the ticket comes back: move it out of `.archive/`, set `**Status:** ready-for-agent` and untick what is open.

Tickets are English-only; the app's own language switcher (see CONTEXT.md's Language section) is a separate, user-facing feature and not part of the issue-tracker workflow.

## Workflow

- **Creating an issue**: `to-tickets` skill writes a new `.scratch/NNNN-slug.md`, then commits it to `bd-beads-docs` `main` and pushes at once (`git -C ../bd-beads-docs add -A && git -C ../bd-beads-docs commit -m "ticket NN: ..." && git -C ../bd-beads-docs push`)
- **Triaging**: `triage` skill reads and updates a ticket's `**Status:**` line, set to one of the triage labels
- **Resolving**: close the issue by moving it to `.scratch/.archive/`, then commit and push in the docs repo, once the PR that completes it is ready for review. The archive is part of the work, but it is not part of the code PR

## Why markdown in a private repo?

Good for a solo project: full control over issue state in version control, no tracker to run. The tickets are private because they hold plans, prices and unreleased ideas; the code repo is public (ADR 0047).
