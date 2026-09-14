# Issue tracker

Issues are tracked as markdown files stored under `.scratch/` in this repo. Each feature or bug gets its own directory:

```
.scratch/
  feature-name/
    issue.md
    discussion.md (optional)
  another-feature/
    issue.md
```

## Workflow

- **Creating an issue**: `to-tickets` skill writes a new `.scratch/<feature>/issue.md`
- **Triaging**: `triage` skill reads and updates frontmatter in `issue.md`
- **Resolving**: close the issue by moving it to `.scratch/.archive/`

## Why local markdown?

Good for solo projects, repos without a remote, or when you want full control over issue state in version control.
