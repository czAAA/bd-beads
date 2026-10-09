# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **`DESIGN.md`** at the repo root, before any UI work: the visual language every screen follows (ADR 0021).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-local-only-persistence.md
│   ├── 0002-palette-separate-from-bead-catalog.md
│   └── ...
└── src/
```

## ADR numbers

A new ADR takes the highest number used on any branch plus one, since an ADR can exist only on an unmerged branch: `git log --all --name-only --format= -- docs/adr | sort -u | tail -1` (renamed and deleted names count too: a number is never reused). Each number names exactly one ADR; a superseded ADR keeps its number and file, with its Status line naming the one that replaces it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (local-only persistence), but worth reopening because…_
