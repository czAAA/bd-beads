# FirstRunHints

What an empty Project says: only where Projects are kept and how not to lose them. Nothing else is written over the Canvas: no caption beside a control, no arrow, no ring. Approved on the claude.ai canvas "openbeads first-run: decluttered welcome" (ticket 0738), then cut down to the welcome alone in the repo (tickets 0795 and 0798, from the user's screenshot of the welcome by itself). It replaces the hand-drawn notes and arrows of ticket 0725.

## When it shows

- **Whenever the open Project has no beads and no Frame, not even an empty one (ticket 0774)**, on every empty Project (not only the first one, nothing remembered on the device), in every theme. The same rule as the CanvasHint, which shows with it.
- **It goes with the first bead**, fading out over `--duration-fast` (at once under reduced motion). It comes back whenever the Project is emptied again (Clear all beads, or the last bead erased).
- After the first bead the only hint left is the Progress bar's existing no-Frame line, "Select to set a Frame" (ProgressBar card).
- Not with no Project open (EmptyCanvas card), not inside Convert image, never on exports. There is no dismiss button.

## Welcome

Centred on the drawing area, under the CanvasHint line. The risk is plain but calm: a fact and what to do, no alarm words, no warning colour or icon.

- The lead line in Inter 16px medium (`--hint-storage-lead`), `body`, at most 36rem wide: "Your Projects are saved only in this browser, on this device."
- 6px under it the storage line in Inter 14px (`--hint-storage`), `muted`, at most 36rem wide, in two lines on purpose: "If the browser's data is cleared, they go with it." and under it "Keep a file of each one you don't want to lose:" (ticket 0839: the string breaks after its first sentence, so no word sits alone on a line; a screen too narrow for a line balances it, `text-wrap: balance`).
- 10px under it the way to a Project file, the Project panel's own labels in the CanvasHint's chips (DM Mono on `.hint-chip`) joined by "›": `Project › Export › Save Project file`.
- No buttons: opening a file, Convert image and Keyboard shortcuts stay in Menu.
- It sits on the canvas overlay layer (`z-canvas-overlay`), under the Tool pill, the strip and every popover, and does not move with the canvas.
- Nothing covers it when a Project is created (ticket 0839): the question "Ask the browser to keep your Projects?" waits for the first Project file or export (the Keep note, `docs/glossary/`), so the welcome alone carries the advice to keep a file.

## Phone (30rem and under)

The same welcome, at the desktop sizes. No CanvasHint line.

## Accessibility

- The whole layer is decoration: `aria-hidden`, `pointer-events: none`, so the first press on the canvas paints the first bead. The same help is in Keyboard shortcuts and in each control's Tooltip.
- No keyboard stop, nothing to dismiss.

The copy in every language is in `writing.md`, "First-run welcome copy".

Hand-written from the approved canvas (2026-10-31, ticket 0738); static rendition. The welcome cut down to the storage lines in the repo (2026-11-05, tickets 0795 and 0798).
