# EmptyCanvas

What the canvas box shows while no Pattern is open.

- The canvas box keeps its frame, the Canvas strip on top and the Canvas footer below, empty (the Progress bar's bar with nothing in it, the same height and edges as with a Project open). The drawing area shows what an open Project's empty Canvas shows (ticket 0748): the empty positions of New Project's default Technique in its default Bead, at 100%, outlined in the theme's Position mark color on the Canvas's last Background, filling the entire drawing area edge to edge, "No Pattern open yet" in `control` and one line on what to do floating centred over it. Under the line sit the primary New Project button (`plus`) and the import icons, in one row at most `tooltip-wide` wide (they were a bar in the Progress bar's place; that bar is gone). Menu opens by itself on its New Project form whenever this state appears.
- Full-bleed at every breakpoint (ticket 180: reverses the earlier small centred board). The message floats over the board rather than beside it, since the board no longer leaves room next to it.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
