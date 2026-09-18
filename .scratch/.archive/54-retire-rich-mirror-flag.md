# 54: Retire the rich Mirror feature flag

**What to build:** Mirror has one implementation. Per-direction axis counts and copy mode are simply how Mirror works, and the single-centre-axis behaviour they replaced — along with the build-time switch between the two — is gone.

Nothing changes for the user: the flag has been on in every build since it shipped.

- **The flag goes**: its module, its test, the tracked `.env` that sets it, and its entry in the env type declaration.
- **The domain keeps one set of Mirror functions** — the count-based ones — renamed to the plain names. The `ForCounts` suffix only ever meant "not the legacy one", so it stops meaning anything the moment the legacy one is deleted.
- **The on/off axis type and the "bigger half" heuristic go**, with the helpers that exist only to serve them.
- **App.vue loses** the flag constant, its six branches, and the two computeds whose only job was translating legacy on/off booleans into axis counts for Paste.
- **The Toolbox loses** its flag prop, its alternative rendering, and the on/off toggle event.
- **The main integration suite stops mocking the flag off.** That one deleted line promotes roughly 145 tests — Paint, Fill, Undo, storage, Row progress, Delete all, Replace Bead, Bead quantities, transfer, Selection/Copy/Paste, Tool groups — to covering the configuration users actually run.
- **Roughly 7 Mirror tests are ported** to the counter controls, because they have no equivalent in the flag-on suite and their coverage would otherwise be lost: undo and redo of a live-mirrored paint, Fill being unaffected by Mirror, a dragged mirrored stroke, right-click mirrored erase, the mirrored hover preview, the Row progress lock against a mirrored counterpart, and Delete all with Mirror on.
- **Roughly 2 tests are deleted**, being assertions about flag-off UI that no longer describes anything.
- **ADR 0006 gains a third amendment** recording the retirement.

**Blocked by:** 53 (CI gate) — this is the largest diff in the set and should land behind a working test gate

**Status:** ready-for-agent

**Decisions (2026-09-17):**
- ADR 0006's second amendment kept the flag "so it can be switched off quickly". Checked against git: the flag was created by ticket 44, flipped on once, and never flipped off. `.env` is tracked, so switching it off always meant editing a committed file, pushing, and waiting for a Pages deploy — precisely the cost of `git revert`. The flag bought no rollback speed that git does not already provide.
- The rollback target is stale in any case: tickets 48 and 50 both shipped after the flag went on, so flipping it off today would not return to a tested configuration — it would land in one where Paste feeds translated booleans down a path never exercised in production.
- Renaming the surviving functions rides in this diff rather than waiting for a follow-up. The distinguishing names are only meaningful while both variants exist; keeping them after the deletion would preserve a distinction that no longer has two sides.
- The integration suite is **not** restructured here, despite its size. That size is a symptom of App.vue's size, so restructuring belongs after ticket 55 gives it smaller units to test against. The flag-on suite also stays separate for now, so the ported tests are easy to check against what is already there.

- [ ] No feature-flag module, no tracked `.env` flag, no env type entry, and no flag prop or branch anywhere in the app
- [ ] The domain exposes one set of Mirror functions, under the plain names
- [ ] The on/off axis type and the "bigger half" heuristic are gone, with their helpers
- [ ] The main integration suite no longer mocks the flag, and every piece of flag-off-only coverage is either ported or deliberately deleted
- [ ] ADR 0006 carries a third amendment recording the retirement
- [ ] Full suite green, and Mirror behaves exactly as it does in a normal build today
