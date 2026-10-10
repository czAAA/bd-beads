# 380: The glossary is one small file per area, not one 8k-word file

**What to build:** CONTEXT.md's `## Language` glossary (about 280 lines) moves into `docs/glossary/`, one file per area with an index, so an agent reads the short core and greps for the term it needs instead of paying for the whole file every session.

**Blocked by:** 379 (CLAUDE.md context hygiene lines)

**Status:** done

- [x] Every term and its _Avoid_ line moved unchanged (70 terms), links re-pointed from `docs/adr/` to `../adr/`
- [x] `docs/glossary/README.md` lists each file and its terms
- [x] CONTEXT.md keeps Quick start, Key concepts, Where to start and a term index linking each area file
- [x] CLAUDE.md, `docs/agents/domain.md` and CODING_STANDARDS.md point at `docs/glossary/`
