# 103: Measurement tools and stored-data compatibility

**What to build:** The safety net for the performance work in ADR 0018, so "faster" and "looks identical" are checked instead of hoped for. Three things, none of which changes what the app does:

1. A **visual check** that renders fixture Patterns in a real browser and compares them with committed reference screenshots of today's DOM output. Fixtures cover loom, peyote and brick stitch; Row progress on (both directions); a Selection; Mirror axes; a paste preview; and Convert image framing. Each at 25%, 100% and 300% zoom and rotated. It runs in CI.
2. A **performance check**, run by hand, that drives the real app in a browser at a chosen CPU slowdown and prints timings for hover, paint stroke, opening a Pattern and dragging the framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop) and at 6×. Today's numbers are recorded in the ticket as the baseline.
3. A **compatibility test** that loads libraries and Pattern files in every format the app writes today (the original version 1 and the current version 2), including one Pattern larger than the current cell cap, and proves they open unchanged. ADR 0018 promises the stored format, Pattern file and QR sharing do not change; this is what keeps that promise.

**Targets these tools measure against** (agreed in the performance plan): on an iPad Air 13″, 60 fps for hover, paint and pan at 250×250. On the floor (4× slowdown), at least 30 fps at 70×250 and at 250×250. Opening a Pattern paints in about 200 ms. The framing drag is smooth.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A browser-testing tool is added as a development dependency, with a script for the visual check and a script for the performance check
- [ ] The visual check has reference screenshots for the fixtures above, at the three zooms and rotated, and passes on today's code; CI runs it
- [ ] The visual check tolerates only sub-pixel differences and fails when a color, shape, gap or overlay changes
- [ ] The performance check prints the timings above at 4× and 6× slowdown and is not part of CI (timings there are too noisy)
- [ ] Baseline timings on today's DOM rendering are written into this ticket
- [ ] The compatibility test covers a version 1 library, a version 2 library, a single-Pattern file, a whole-library file and an over-cap Pattern, and passes on today's code
- [ ] How to run each check is documented where the other scripts are
