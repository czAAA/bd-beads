# 196: Extract new-Pattern creation into useNewPatternFlow

**What to build:** Creating a new Pattern — whether a blank one or via Convert image — works exactly as today, but lives in a new `useNewPatternFlow` composable instead of inline in App.vue. Independent of the other extractions in ADR 0023.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `useNewPatternFlow` owns creating a blank Pattern and creating one from Convert image
- [x] App.vue no longer declares any of this directly
- [x] Both new-Pattern paths (blank, convert-image) behave exactly as before, including existing Convert-image tests
- [x] App.vue still boots and all other existing tests pass
