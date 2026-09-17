# Issue tracker

Issues are tracked as markdown files stored under `.scratch/` in this repo, one flat file per ticket, named `NN-slug.md` (e.g. `52-vocabulary-alignment.md`):

```
.scratch/
  52-vocabulary-alignment.md
  53-ci-gate.md
  ru/
    52-vocabulary-alignment.md
    53-ci-gate.md
  .archive/
    51-move-new-pattern-cta-and-zoom-controls.md
```

- `ru/` holds a Russian-language copy of each open ticket, same filename, alongside the English original.
- `.archive/` holds resolved tickets, moved there once closed.

## Workflow

- **Creating an issue**: `to-tickets` skill writes a new `.scratch/NN-slug.md`
- **Triaging**: `triage` skill reads and updates a ticket's `**Status:**` line, set to one of the triage labels
- **Resolving**: close the issue by moving it (and its `ru/` copy) to `.scratch/.archive/`

## Why local markdown?

Good for solo projects, repos without a remote, or when you want full control over issue state in version control.
