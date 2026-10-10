# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, the short core. Its glossary is `docs/glossary/`: grep it for the terms you need instead of reading it whole.
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

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the glossary (`docs/glossary/`, indexed from `CONTEXT.md`). Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (local-only persistence), but worth reopening because…_

## Writing ADRs

- **An ADR holds the decision as it stands today.** When a decision changes, rewrite the ADR in place: no "Amended by" notes, no superseded paragraphs. Git keeps the history; a rejected earlier version may go in Considered options in a line. Earlier wording is not kept, so every ADR uses today's glossary.
- **One ADR per decision.** A new decision on the same topic is folded into its ADR, which keeps its number so citations stay valid. An ADR whose decision is gone entirely is deleted, and its citations in `src/`, `e2e/` and the docs are pointed at what replaced it. Archived tickets are left alone.
- **Decisions only.** Runbooks, work plans and review guidance belong in `docs/`, not `docs/adr/`.
- **An ADR may lead the code.** A decision that isn't built yet says so in its Status line, with the ticket that builds it: `Code catches up in ticket N.`
- **Numbers.** A new ADR takes the highest number in `docs/adr/` plus one. A number is never reused, even after its ADR is deleted, so an old citation can't point at the wrong decision.
