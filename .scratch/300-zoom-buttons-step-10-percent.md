# 300: Zoom buttons move 10% at a time, and the Zoom pill is always there on small devices

**What to build:** Zoom in and zoom out (the desktop buttons and the Zoom pill) move the zoom 10% a step, 10, 20, 30 and so on, instead of 25%, so the new low end is reachable without awkward jumps. Pinch and wheel stay continuous at whole-percent precision, and the shown level is right at every step.

On small devices, up to a 10″ iPad, the Zoom pill is always visible: whenever a Project is open and its canvas is on screen, the person can reach zoom out, zoom in and Fit without opening anything. Today the pill is only shown with a Project open and outside Convert image framing, and only under 1024px (ADR 0032). A 10″ iPad held sideways is about 1080px wide and keeps the desktop layout (ADR 0032's 1024px split stands), so there the same always-visible zoom is the one in the canvas strip, shown on touch devices at every width: zoom out, zoom in and Fit must stay on screen, not folded into a menu.

**Blocked by:** 298 (Zoom out to 10% on every screen, with the ruler numbers thinning).

**Status:** ready-for-agent

- [ ] From 100%, zoom out reaches 90, 80, ... down to 10%, and zoom in climbs the same rungs back
- [ ] The zoom level label and the applied scale agree at every step
- [ ] The buttons disable at 10% and at the top zoom
- [ ] On a phone (the Zoom pill) and on a 10″ iPad in both orientations (the pill, or the canvas strip's zoom in landscape), zoom out, zoom in and Fit are always on screen with a Project open: not behind a sheet, the Frame bar, the Progress bar or the on-screen keyboard (audit each state and list any that hide them, with the fix or the reason)
- [ ] Pinch and wheel are unchanged apart from the new floor
- [ ] Unit tests for the step and the clamps
