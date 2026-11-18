# CanvasHint

The one line at the top-centre of the drawing area, under the strip, that says how to move the open canvas and names its shortcuts.

- **Text:** "scroll or `space` drag to move · `⌘` scroll to zoom · `5` Hand · `R` Rulers · right-click for tools". Inter 12/16 in `muted`; each key is a Kbd chip, 20px here, with 10px before every chip after the first. `5` is the Hand tile's key on the Tool pill; there is no Set Frame key, as the bar's no-Frame line, which picks Select, covers it (tickets 0846, 0944).
- **On touch** (writing.md, A help line fits the device in hand): "two fingers to move · pinch to zoom · hold a button for its name", the same type with no chips (the last part ticket 0927: nothing else says a hold shows a name). A real key pressed, or the Keyboard shortcuts switch turned on, brings the key line back.
- **Place:** centred on the drawing area, 12px under the strip, under any overlay. It does not move with the canvas.
- **Shown only while the Project has no beads and no Frame (an empty Frame hides it, ticket 0774)**, at every size except a phone (30rem and under, with no room for it). It goes with the first bead and returns if the Project is emptied (ticket 429).
- On Windows and Linux the `⌘` chip reads "Ctrl".
- aria-hidden: the same shortcuts are listed in Keyboard shortcuts (ShortcutsHelp).
- **Shown with the first-run welcome** (FirstRunHints card, tickets 0725, 0798), by the same rule: the welcome sits under this line and goes with the first bead too.
- **Mirror's Area pick** had a line of its own here (ticket 0710); it is retired with the Mirror popover (ticket 0750): Mirror mode says itself by the lit Mirror tile and the Select tool's cursor (ContextBar card, Mirror bar).
- **The Radial toolbox's part:** each line's last part says how the ring opens (RadialToolbox card). With a keyboard: "… · `R` Rulers · right-click for tools", plain words with no chip, as a click has no key (ticket 1064). On touch (approved 2026-11-18, not yet in the app; ticket 1065): "two fingers to move · pinch to zoom · hold a button for its name · hold the Canvas for tools". "Tools" stands for the pill, colours included. This line is the one place that teaches the ring; the first-run welcome does not grow.

Hand-written from the v16 sign-off (open canvas mockups); static rendition.
