# 378: The ruler dots stay close to the piece when zoomed out

**What to build:** ticket 377 brought the line closer when zoomed out, but below 50% zoom, where a ruler shows only its last number, the dots still stood out on the widest number's band, about 14px from the line. They now hug the line there, and the gap between numbers and line is narrower at 12.5% zoom and below. Review tidy-ups from 377 go with it: clearer names, shared curves, doc comments.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Below 50% zoom the dots stand a gap and a dot's radius off the line
- [x] The gap is half as wide at 12.5% zoom and below
- [x] `across` is `interpolateByZoom`, the shared curves are named, `RulerScale` fields are commented, `RULED_PIECE_MIN_BEADS` says what it means
- [x] Rulers card and README changelog say so
- [x] The ticket is archived in the same change

Left out: the dots' offset at 50% and above, and the Ruler step thresholds, are unchanged. Not checked on screen.
