# ProjectPanel

The body of Project: everything about the open Project, and nothing the Selection bar, the Progress bar or the tool pill already does. A dropdown on every screen size. Hidden, not disabled, while no Project is open. Menu is the MenuPanel card. (Spec 0440, tickets 0441 to 0443.)

The panel shell (width, edge, radius, motion, closing, focus) is the MenuPanel card's. The Project button sits on `ink` while the panel is open.

## Sections, in this order

1. **Head:** the Project's name (Inter 600, 17/22, one line, ellipsis) with a **pencil**, then the save state.
2. **Technique:** the Frame's own, a SegmentedControl, full width (the techniques, as today), shown with a Frame, then the existing Note explaining what changes, `body` 13/18; with brick stitch the Brick block stepper under it. Locked once a Row progress pass is done (ticket 0492).
3. **Bead:** one line, "bead:" in the `label` style, the Bead's name in Inter 500, then the **BeadPicker** (compact: its hint and a small "Change" button) on the next line, which replaces the old Replace bead button. No color dot or pill. Left aligned in one row, so on a phone `bead: Delica 11/0 [Replace bead]` fits at 334px.
3b. **Canvas Technique (ticket 0492):** under the Bead line, the Canvas's own: the label "Canvas Technique" (`label` style) over a SegmentedControl, full width, small, with the Brick block stepper under it for brick stitch. Enabled at any time (Row progress belongs to the Frame); its Tooltip says every bead keeps its row and column and the Frame keeps its own. Hidden where the Canvas is woven in Right-angle weave or Netting, which are fixed.
4. **Canvas:** see below.
5. **Save and export:** Save Project (primary, `save` icon, full width, the one accent in the panel), then the Export label and three buttons, PNG | PDF | Project file (the `in-box` look so they show on `overlay-fill` in dark too, 34px, 8px apart, sharing the row equally; a word that needs more room wraps the last button to a second row instead of squeezing or breaking), then the Name on exports row.
6. **Beads needed** (the existing expandable panel, ticket 146) stays above Manage: no card or mockup placed it, and the panel is the only place it has. A design decision may move it.
7. **Manage:** Duplicate, Clear this Project and Delete this Project, as panel items; the last two are `danger`. Clear this Project is the app's existing Clear: every bead of this canvas emptied and Row progress off, behind its usual confirmation, one Undo step; the Project stays.

The Frame's Edit, Fit and Remove are not here (Fit and Remove stay on the Progress bar and the Selection bar; Edit Frame, which had no other way in, becomes an icon button on the Progress bar, ProgressBar card). With a Frame, the Frame's Estimated size line and its Note stay under Technique (Frame card). With no Frame, PNG and PDF open the existing "Set Frame to export" popover (SaveBox card); nothing is duplicated.

## Head and save state

- **Pencil:** 30px ghost icon button, `muted`, `ink` on hover, named "Rename {name}". It turns the heading into a TextField in place, with Save (check, `accent-strong`) and Cancel (×) beside it and a counter "n/40" in `meta`. Enter saves, Escape cancels, Save is disabled and the field gets the `danger` edge with "A Project needs a name." while empty. The name follows the existing 40 character rule. Rename is saved at once and is not part of Undo.
- **Save state** under the name, `meta`, with a 14px icon: saved = check in `accent-strong` and "saved · this device"; unsaved = a dashed circle and "unsaved changes"; failed = a `danger` warning, "Not saved. {reason}" in 13 / 500, and a text button "Try again" at the right. This replaces the SaveBox's label row.

## Canvas

- **Background color:** the five light or six dark Canvas colors as 28px round swatches, 8px apart, the chosen one ringed with `ring` and a 2px gap in the panel's fill; each swatch's accessible name is "{name}, {n} of {c}" (CanvasBackground card). `role="radiogroup"`.
- **Position marks:** a row with the label and Dots | Squares.
- **In high contrast** the canvas is fixed white, so the swatches are replaced by one `body` line, "The canvas stays white in high contrast.", and only Position marks remains. The Canvas color button no longer exists on the strip.

## Name on exports (a pencil row)

Per Project, not per device (ADR 0060). It is the only place the Maker's name is set.

- **Unset:** the row is an already-open TextField (label "Name on exports" above it, placeholder "Your name", counter "0/40") with the hint "Printed on this Project's PDF and PNG exports." Enter or leaving the field saves it; leaving it empty prints no name.
- **Set:** one row, the label in `label` style, the name in Inter 500, and a pencil named "Edit Name on exports". The pencil swaps the name for the same field with the value; an empty value clears it back to unset.
- The Export menu no longer carries a name footer, and there is no separate modal or device-wide field.
- On exports the name is still set in Instrument Serif italic (printed-output.md); only its place in the app changes.

## Duplicate and Delete

- Both close the panel, then open a dialog on the Modal shell (ConfirmDialogs card), `z-modal`. Neither is part of Undo and both act at once.
- **Duplicate:** "Duplicate Project", the note "Everything is copied, including Row progress, so the copy works as a snapshot.", a TextField "Name" holding the suggestion, its hint "Suggested: the current name and the next free number.", Cancel and a primary Duplicate. The suggestion is the name plus the first unused number from 2: "Moth" suggests "Moth 2", then "Moth 3" once that exists; a name that already ends in a number ("Moth 2") suggests the next free one ("Moth 3"). Cancel leaves everything as it was. After confirming, the copy opens.
- **Delete this Project:** "Delete {name}?", "{name} and its Row progress are removed from this device. This can't be undone. Export it first if you want to keep a copy.", Cancel and a `danger`-filled "Delete Project". Afterwards the app shows the empty state with New Project and Import (EmptyCanvas card).

## Keyboard and screen readers

- Arrows move through the items and buttons; Tab leaves the panel; focus returns to the Project button. Escape first ends a rename or an edit of a set Name on exports, and only then closes the panel.
- The pencils are named for what they edit ("Rename Moth", "Edit Name on exports"); each section is a named group; the save state is a polite live region, so "Not saved" is announced.

## Copy

English: Project, Rename, Save Project, Export, PNG, PDF, Project file, Name on exports, Your name, Duplicate, Delete this Project, Delete Project, Technique, Bead, Replace bead, Canvas, Position marks, Dots, Squares. Russian: `writing.md`.

Hand-written from spec 0440 and the Menu and Project mockups; static rendition.
