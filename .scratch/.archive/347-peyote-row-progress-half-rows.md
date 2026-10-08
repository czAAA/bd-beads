# 347: Peyote Row progress marks and locks only the beads of the current pass

**What to build:** on a peyote Project, Row progress treats the first pass as the whole line of beads and every later pass as every other bead of the line, instead of a full line each time. The current-row highlight, the dimming of finished rows and the finished-row lock all follow it. Loom and brick stitch are unchanged.

Today the first row highlights correctly (all its beads), but the second and every following row also highlight a full line. In peyote the weaver adds half the beads on each later pass, so only that half should be marked.

For a line of N beads (N is the number of beads along the Row direction, whichever direction is set), pass 1 is all N; pass k ≥ 2 is the beads that pass adds:

- Odd N (example 7): 7, 4 (N/2 rounded up), 3 (N/2 rounded down), 4, 3, 4, ... alternating up/down.
- Even N (example 8): 8, 4, 4, 4, ...

The reporter's screenshot colours each pass: for 7 beads, white = 7 (pass 1), red = 4 (pass 2), yellow = 3 (pass 3), green = 4 (pass 4); for 8 beads, orange = 8, pink = 4, green = 4, gray = 4. Passes sit on the beads at their own offset in the half-shifted layout, so a pass is not a simple left-to-right half but the alternate beads on its own stagger. The screenshot is the source of truth for exactly which beads belong to which pass.

Open question to confirm with the reporter while building: which pass count Row progress shows and moves through (the number of passes, Progress bar, "current row" number in the labels) once passes are no longer one-per-line. Keep what the Progress bar and the labels count consistent with the highlighted beads.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Peyote, odd line length (7): passes mark 7, 4, 3, 4, 3, ... beads, matching the screenshot
- [x] Peyote, even line length (8): passes mark 8, 4, 4, 4, ... beads, matching the screenshot
- [x] Both Row directions (along the rows, down the columns) behave the same way
- [x] Finished passes are dimmed and locked against Paint, Erase, Fill, Paste and Mirror only for the beads they cover; beads of a later pass stay editable
- [x] Loom and brick stitch Row progress are unchanged
- [x] Row progress's label, Progress bar and Row direction pointer stay consistent with the marked beads
- [x] Unit tests cover the odd and even cases; CONTEXT.md's Row progress entry says what a peyote pass is
