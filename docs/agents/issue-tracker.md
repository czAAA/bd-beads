# Issue tracker

Issues are tracked as markdown files stored under `.scratch/` in this repo, one flat file per ticket, named `NN-slug.md` (e.g. `52-vocabulary-alignment.md`):

```
.scratch/
  52-vocabulary-alignment.md
  53-ci-gate.md
  .archive/
    51-move-new-pattern-cta-and-zoom-controls.md
```

- `.archive/` holds resolved tickets, moved there once closed.
- Tickets stay flat: every open ticket is `.scratch/NN-slug.md`, never in a per-feature or per-epic folder. The slug is a few lowercase words, hyphenated.

## Ticket numbers

A new ticket takes the highest number in use plus one, counted across `.scratch/`, `.scratch/.archive/` and every branch name (local and remote, since a ticket can live only on an unmerged branch):

```sh
{ ls .scratch .scratch/.archive; git branch -a; } | grep -oE '(^|/)[0-9]+-' | grep -oE '[0-9]+' | sort -n | tail -1
```

A number is never reused, and a ticket keeps its number when it moves to `.archive/`.

## Ticket format

```markdown
# NN: Title, saying the outcome in the user's words

**What to build:** what changes for the person using the app, and why. Cause and known limits, if found, follow as paragraphs.

**Spec:** NN (the spec ticket this one implements), if any

**Blocked by:** None (can start immediately) | NN, NN (what each one brings)

**Status:** needs-triage

- [ ] One checkable outcome per line
- [ ] ...
- [ ] The ticket is archived in the same change
```

- `**Status:**` holds exactly one triage label (`docs/agents/triage-labels.md`); a ticket with a branch or worktree being worked on is at least `ready-for-agent` or `ready-for-human`, never `needs-triage`.
- Sections a larger ticket may add under the checklist: `### <group>` headings to split the checklist, and `### Done when` for the checks that close it.
- On closing, tick every box that was done, say in the ticket what was left out and why, set `**Status:** done`, and move the file to `.archive/` in the same change.

Tickets are English-only; the app's own language switcher (EN / RU / ZH / ES / PL) (see CONTEXT.md's Language section) is a separate, user-facing feature and not part of the issue-tracker workflow.

## Workflow

- **Creating an issue**: `to-tickets` skill writes a new `.scratch/NN-slug.md`
- **Triaging**: `triage` skill reads and updates a ticket's `**Status:**` line, set to one of the triage labels
- **Resolving**: close the issue by moving it to `.scratch/.archive/`

## Why local markdown?

Good for solo projects, repos without a remote, or when you want full control over issue state in version control.
