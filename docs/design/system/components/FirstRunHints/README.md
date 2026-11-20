# FirstRunHints

What an empty Project says: the next step, how to place a bead, and under it one quiet line on where Projects are kept (ticket 0920). Nothing else is written over the Canvas: no caption beside a control, no arrow, no ring. The full advice on keeping a Project file is where it is acted on: the Project panel (Save Project file) and the Save reminder on the Canvas strip (SaveReminder card). Approved on the claude.ai canvas "openbeads first-run: decluttered welcome" (ticket 0738), then cut down to the welcome alone in the repo (tickets 0795 and 0798, from the user's screenshot of the welcome by itself). It replaces the hand-drawn notes and arrows of ticket 0725.

## When it shows

- **Whenever the open Project has no beads and no Frame, not even an empty one (ticket 0774)**, on every empty Project (not only the first one, nothing remembered on the device), in every theme. The same rule as the CanvasHint, which shows with it.
- **It goes with the first bead**, fading out over `--duration-fast` (at once under reduced motion). It comes back whenever the Project is emptied again (Clear all beads, or the last bead erased).
- After the first bead the only hint left is the Progress bar's no-Frame line, "Mark the piece to export and count: drag with Select." (ProgressBar card, ticket 0944).
- Not with no Project open (EmptyCanvas card), not inside Convert image, never on exports. There is no dismiss button.
- **The first thing a newcomer sees (ticket 0866):** Make your first Project makes "Project 1" at once and opens on its Canvas with no panel open, so the welcome, the CanvasHint and the Tool pill are the whole first screen.

## Welcome

Centred on the drawing area, under the CanvasHint line. What to do comes first; where the work lives is a calm fact under it, no alarm words, no warning colour or icon.

- The lead line in Inter 16px medium (`--hint-storage-lead`), `body`, at most 36rem wide: the next step in the Paint tool's own Tooltip words, "Tap or drag to place beads in the chosen color." on touch, and in mouse words, "Click or drag to place beads in the chosen color.", with a mouse (ticket 0920). Touch or mouse is the one rule for every help line (`useHelpDevice`, writing.md "A help line fits the device in hand").
- 6px under it the storage line in Inter 14px (`--hint-storage`), `muted`, at most 36rem wide, one line: "Your Projects are saved only in this browser, on this device." A screen too narrow for it balances it (`text-wrap: balance`).
- No path to the Project file and no chips (ticket 0920): the welcome says no more about keeping a file than where the work lives; the Save reminder asks for the file once there is work to keep.
- No buttons: opening a file, Convert image and Keyboard shortcuts stay in Menu.
- It sits on the canvas overlay layer (`z-canvas-overlay`), under the Tool pill, the strip and every popover, and does not move with the canvas.
- Nothing covers it when a Project is created (ticket 0839): the browser is asked to keep the Projects only at the first Project file or export, with no question of the app's (ticket 0936).

## Phone (30rem and under)

The same welcome, at the desktop sizes. No CanvasHint line.

## Accessibility

- The whole layer is decoration: `aria-hidden`, `pointer-events: none`, so the first press on the canvas paints the first bead. The same help is in Keyboard shortcuts and in each control's Tooltip.
- No keyboard stop, nothing to dismiss.

The copy in every language is in `copy/canvas.md`, "First-run welcome copy".

Hand-written from the approved canvas (2026-10-31, ticket 0738); static rendition. The welcome cut down to the storage lines in the repo (2026-11-05, tickets 0795 and 0798), then led by the next step with the storage as one quiet line under it (2026-11-14, ticket 0920, Impeccable UX audit UX-001).
