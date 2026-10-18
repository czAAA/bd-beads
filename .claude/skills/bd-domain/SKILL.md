---
name: bd-domain
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.
---

The *active* discipline of building the domain model as you design: challenge terms, probe edge cases, and write the glossary and decisions down the moment they crystallise. (Merely reading `CONTEXT.md` for vocabulary isn't this skill; this is for changing the model.)

Files: `CONTEXT.md` at the root is the short core; its glossary is `docs/glossary/`, one file per area, indexed in CONTEXT.md's Language table. Glossary entries hold no implementation details: not a spec or scratch pad. Decisions go in `docs/adr/`, in the docs repo, linked in. `docs/agents/domain.md` (Writing ADRs) wins over [ADR-FORMAT.md](ADR-FORMAT.md).

## During the session

- **Challenge against the glossary.** When a term conflicts with the glossary, say so at once: "Your glossary defines 'cancellation' as X, but you seem to mean Y."
- **Sharpen fuzzy language.** Propose a precise canonical term for vague or overloaded ones ("account": the Customer or the User?).
- **Use concrete scenarios.** Invent edge cases that force precise boundaries between concepts.
- **Cross-check the code.** When the user says how something works, check it; surface contradictions ("the code cancels whole Orders, but you said partial cancellation is possible").
- **Update the glossary inline** (`docs/glossary/<area>.md`, plus its row in CONTEXT.md's Language table for a new term) as each term resolves, never batched. Entry format: [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md).
- **Offer an ADR only when all three hold:** hard to reverse; surprising without context; the result of a real trade-off. Format: [ADR-FORMAT.md](ADR-FORMAT.md).
