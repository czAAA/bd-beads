# CanvasHint

The one line at the top-centre of the drawing area, under the strip, that says how to move the open canvas and names its shortcuts.

- **Text:** "scroll or `space` drag to move · `⌘` scroll to zoom · `5` Hand · `R` Rulers". Inter 12/16 in `muted`; each key is a Kbd chip, 20px here, with 10px before every chip after the first. `5` is the Hand tile's key on the Tool pill; there is no Set Frame key, as the bar's "Select to set a Frame" covers it (ticket 0846).
- **On touch** (writing.md, A help line fits the device in hand): "two fingers to move · pinch to zoom", the same type with no chips. A real key pressed, or the Keyboard shortcuts switch turned on, brings the key line back.
- **Place:** centred on the drawing area, 12px under the strip, under any overlay. It does not move with the canvas.
- **Shown only while the Project has no beads and no Frame (an empty Frame hides it, ticket 0774)**, at every size except a phone (30rem and under, with no room for it). It goes with the first bead and returns if the Project is emptied (ticket 429).
- On Windows and Linux the `⌘` chip reads "Ctrl".
- aria-hidden: the same shortcuts are listed in Keyboard shortcuts (ShortcutsHelp).
- **Shown with the first-run welcome** (FirstRunHints card, tickets 0725, 0798), by the same rule: the welcome sits under this line and goes with the first bead too.
- **Mirror's Area pick** had a line of its own here (ticket 0710); it is retired with the Mirror popover (ticket 0750): Mirror mode says itself by the lit Mirror tile and the Select tool's cursor (ContextBar card, Mirror bar).

Hand-written from the v16 sign-off (open canvas mockups); static rendition.
