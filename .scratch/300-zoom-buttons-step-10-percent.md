# 300: Zoom buttons move 10% at a time

**What to build:** Zoom in and zoom out (the desktop buttons and the Zoom pill) move the zoom 10% a step, 10, 20, 30 and so on, instead of 25%, so the new low end is reachable without awkward jumps. Pinch and wheel stay continuous at whole-percent precision, and the shown level is right at every step.

**Blocked by:** 298 (Zoom out to 10% on every screen, with the ruler numbers thinning).

**Status:** ready-for-agent

- [ ] From 100%, zoom out reaches 90, 80, ... down to 10%, and zoom in climbs the same rungs back
- [ ] The zoom level label and the applied scale agree at every step
- [ ] The buttons disable at 10% and at the top zoom
- [ ] Pinch and wheel are unchanged apart from the new floor
- [ ] Unit tests for the step and the clamps
