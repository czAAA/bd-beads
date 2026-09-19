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

Tickets are English-only; the app's own EN/RU language switcher (see CONTEXT.md's Language section) is a separate, user-facing feature and not part of the issue-tracker workflow.

## Workflow

- **Creating an issue**: `to-tickets` skill writes a new `.scratch/NN-slug.md`
- **Triaging**: `triage` skill reads and updates a ticket's `**Status:**` line, set to one of the triage labels
- **Resolving**: close the issue by moving it to `.scratch/.archive/`

## Why local markdown?

Good for solo projects, repos without a remote, or when you want full control over issue state in version control.
