# 52: Align the code's names with the glossary

**What to build:** The project's names match its own language. A reader looking for Bead quantities finds a module named for Bead quantities; the set of saved Patterns has a name in CONTEXT.md; nothing is exported that nothing calls.

- **CONTEXT.md gains a Pattern library entry.** The set of every Pattern saved on this device is all over the system — the Saved Patterns box lists it, a library Pattern file exports it, CONTEXT.md's own Pattern file entry already says "one Pattern or a whole library" — but it has never been defined. Wording agreed:

  > **Pattern library** (RU: Библиотека схем):
  > Every Pattern saved on this device, taken together — what the Saved Patterns box lists and what a library Pattern file exports in one go. It is a flat set with no ordering, grouping or nesting: a Pattern belongs to the library from the moment it is created, and leaves it only by being removed. Lives only on the device that made it (ADR 0001), so moving it anywhere means exporting a Pattern file.
  > _Avoid_: collection, gallery, saved list, workspace

- **`beadMapping.ts` becomes `beadQuantities.ts`.** It computes Bead quantities, which is a glossary term; it is named for the colour-to-bead mapping that ADR 0007 retired.
- **`beadStorage.ts` folds into `beads.ts`.** It stores nothing — it is one lookup over a constant catalog. Its tests merge into the catalog's.
- **Two dead domain exports go, with their tests:** the unmirrored paste-block stamp (superseded by the Mirror-aware one in ticket 50) and the single-cell paint (superseded by the multi-cell one in ticket 24). Neither has a caller outside its own test.
- **The unused `shell.mainPanelPlaceholder` key goes** from the Translations interface and both dictionaries.
- **`@testing-library/jest-dom` goes.** `setupTests.ts` consists of a single import that registers roughly 30 custom matchers, and not one of them is used anywhere — all 663 tests assert with plain Vitest. The dependency, `setupTests.ts` itself, and the `setupFiles` entry in the Vite config all go together.
- **`docs/agents/issue-tracker.md` is corrected** to describe the flat `.scratch/NN-slug.md` layout this repo actually uses, rather than the per-feature directory layout it currently documents and that practice abandoned.

No behaviour change: same UI, same saved data, same exported files.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- "Pattern library" rather than plain "Library" — "Library" alone is too generic standing next to "Pattern file" and "Bead catalog" in the same glossary, and the export format already spells it `bd-beads/library` under a Pattern-scoped kind.
- The entry pins the library as a flat set with no ordering, grouping or nesting. That is the valuable half: a future "can Patterns go in folders?" question should find the current answer written down. If the answer ever changes, amending one glossary line is the cheapest possible change.
- This ticket is sequenced first so tickets 55 and 56 are written in the right vocabulary from their first line, instead of being renamed afterwards.
- Renames and deletions only. No module is split or restructured beyond folding the one-function catalog lookup into the catalog itself.
- The jest-dom removal was verified empirically rather than inferred: the full suite was run once with `setupFiles` omitted entirely and passed unchanged — 30 files, 663 tests. Nothing in the repo depends on the matchers it registers.

- [ ] CONTEXT.md has the Pattern library entry, with its RU term and _Avoid_ list, among the other glossary entries
- [ ] Bead quantities are computed by a module named for them, with every import updated
- [ ] The Bead-catalog lookup lives in the catalog module; the storage-named module is gone and its tests merged
- [ ] The unmirrored paste-block stamp and the single-cell paint exports are gone, along with their tests
- [ ] `shell.mainPanelPlaceholder` is gone from the Translations interface and from both dictionaries
- [ ] `@testing-library/jest-dom` is gone from package.json, `setupTests.ts` is deleted, and the Vite config no longer names a setup file — with the full suite still green
- [ ] `docs/agents/issue-tracker.md` matches the flat numbered-file layout actually in use
- [ ] `npm test` and `npm run typecheck` pass, and the app behaves exactly as before
