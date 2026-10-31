# CanvasHint

The one line at the top-centre of the drawing area, under the strip, that says how to move the open canvas and names its shortcuts.

- **Text:** "scroll or `space` drag to move · `⌘` scroll to zoom · `H` Hand · `F` Set Frame · `R` Rulers". Inter 12/16 in `muted`; each key is a Kbd chip, 20px here, with 10px before every chip after the first.
- **Place:** centred on the drawing area, 12px under the strip, under any overlay. It does not move with the canvas.
- **Shown only while the Project has no beads**, at every size except a phone (30rem and under, which has no wheel and no keyboard). It goes with the first bead and returns if the Project is emptied (ticket 429).
- On Windows and Linux the `⌘` chip reads "Ctrl".
- aria-hidden: the same shortcuts are listed in Keyboard shortcuts (ShortcutsHelp).
- **Shown with the first-run hints** (FirstRunHints card, tickets 0725, 0738), by the same rule: the captions and the welcome sit under this line and go with the first bead too.
- **While Mirror's Area is being picked** (MirrorPopover card, ticket 0710) the line says how instead, beads or not: "Drag over the beads · click the margin for the whole Frame · `Esc` cancels" on a Frame, "Drag over the beads to set the area · `Esc` cancels" on the Canvas, in `marker` with a 1px `marker` border on `elevated` (`radius-full`, 4px 10px padding), read out rather than aria-hidden since it is the pick's only instruction.

Hand-written from the v16 sign-off (open canvas mockups); static rendition.
