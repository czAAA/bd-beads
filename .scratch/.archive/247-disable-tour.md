# 247: Disable the Tour behind a flag

**What to build:** Hide the Tour (ticket 80) behind `TOUR_ENABLED` in `src/features.ts`, currently `false`. Nothing of the Tour is deleted; flipping the flag brings it back. CLAUDE.md no longer asks whether new functionality belongs in the Tour.

**Blocked by:** None

**Status:** done

**Overview / Tour:** n/a (this removes the Tour's entry points).

- [x] No "Take the tour" item in the editor menu or the Overview menu
- [x] No Tour band on the Overview
- [x] A Tour left `running` on a device does not resume
- [x] Tour code and its tests stay (tests turn the flag on)
- [x] CLAUDE.md drops the Tour from the "add to Overview and Tour?" check
