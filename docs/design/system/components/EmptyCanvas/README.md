# EmptyCanvas

What the canvas box shows while no Project is open.

- The canvas box keeps its frame, the Canvas strip on top and the Canvas footer below, empty (the Progress bar's bar with nothing in it, the same height and edges as with a Project open). The drawing area shows what an open Project's empty Canvas shows (ticket 0748): the empty positions of New Project's default Technique in its default Bead, at 100%, outlined in the theme's Position mark color on the Canvas's last Background, filling the entire drawing area edge to edge, with the message floating centred over it. Menu opens by itself on its New Project form whenever this state appears.
- The message has three cases (ticket 0840):
  - **A panel is over the Canvas** (the Menu on its New Project form, as it opens here, or any other): no message and no buttons, only the positions. The panel is the message; a message behind it would show cut by its edge.
  - **No panel, nothing deleted:** "No Project open yet" in `control`, then one `meta` paragraph in `muted` of two sentences, what to do ("Make one with New Project, open one from the Projects library, or open a Project file.") and how to move the Canvas ("Drag the Canvas around with the right mouse button or Space."), each its own string so a device can swap one. Under it the primary New Project button (`plus`) and the Open Project file icon, in one row (Open's result or error wraps onto a line of its own under them) at most `tooltip-wide` wide (they were a bar in the Progress bar's place; that bar is gone).
  - **No panel, after a delete that left no Project open:** "“Sunflower” was deleted." with the Project's own name in `control`, then "Open another from the Projects library, or make a new one.", a `link` Button "Projects library" (`library`) that opens the Menu on the Projects library, and the same New Project and import row. It stays until a Project opens.
- The message is whole, never cut, at every width from phone to laptop in all seven languages.
- Full-bleed at every breakpoint (ticket 180: reverses the earlier small centred board). The message floats over the board rather than beside it, since the board no longer leaves room next to it.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
