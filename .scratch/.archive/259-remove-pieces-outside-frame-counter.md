# 259: Remove the "pieces outside the Frame" counter

**What to build:** The canvas strip no longer says "N pieces outside the Frame" when a Frame is set. The feature is removed with its code, English and Russian strings and tests. The rest of the strip (the Pattern size line, and "Canvas · N pieces · no Frame" with no Frame) stays as it is.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] With a Frame set, the strip shows no count of Pieces outside it, however many there are
- [ ] No code, string, test or doc still refers to the counter (design system copy is not edited by hand; note it for the next design system version)
- [ ] CONTEXT.md and any ADR text that mention the counter are updated
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: no
