# 254: Split the App test file by feature

**What to build:** The largest App test file (about 260 tests, 85s) no longer sets a floor on the unit run. Vitest runs files in parallel but one file in one worker, so one 85s file keeps one of the two CI workers busy while the other finishes everything else. The file is split along its existing `describe` groups (keyboard and hotkeys, Eraser, delete all, replace bead, select/copy/paste, row progress and finished rows, and so on) into files of roughly 20-30s each, so the workers balance and the run can later be sharded evenly.

Tests move as they are: same tests, same names, same count.

**Blocked by:** 253 (Audit and slim the App-level tests), so tests that are about to be moved or deleted aren't split first.

**Status:** done

**Overview / Tour:** not applicable (no user-facing change); recorded per CLAUDE.md.

- [x] No App test file takes more than about 30s on CI
- [x] The total test count is the same as before the split
- [x] Shared setup moves to the existing test helpers, not copied into each new file
- [x] The unit run on CI is shorter than before the split, with the per-file times in the PR description
