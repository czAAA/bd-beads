# EmptyCanvas

What the canvas box shows while no Pattern is open.

- The canvas box keeps its frame; the drawing area shows an empty board (the `board` with `bead-empty` beads, no curve or word) filling the entire drawing area edge to edge, "No Pattern open yet" in `control` and one line on what to do floating centred over it. The Progress bar is hidden until a Pattern is open.
- Full-bleed at every breakpoint (ticket 180: reverses the earlier small centred board). The message floats over the board rather than beside it, since the board no longer leaves room next to it.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
