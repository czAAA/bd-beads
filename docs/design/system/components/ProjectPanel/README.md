# ProjectPanel

The body of Project: everything about the open Project, and nothing the Selection bar, the Progress bar, the tool pill or the Frame panel already does. A dropdown on every screen size. Hidden, not disabled, while no Project is open. Menu is the MenuPanel card. (Spec 0440, tickets 0441 to 0443; redesigned in tickets 0553 and 0554, design canvas https://claude.ai/artifact/DtuwrYB8pNEabwFCYCC8wB.)

The panel shell (width, edge, radius, motion, closing, focus), the density and the four shared parts (PanelSection, PanelItem, PanelPicker, PanelListRow) are the MenuPanel card's. The Project button sits on `ink` while the panel is open.

## Head (always shown, not collapsible)

1. **Title line:** `project:` in the `label` style at the left, as a section header; at the right two 24px save-state icons, each with a Tooltip and an accessible name, together a polite live region:
   - **Local:** `save` (the floppy disk). Saved: `accent-strong`, "Saved in local browser". Unsaved changes: `muted` with a 5.5px `accent-strong` dot on its top-right corner, "Not saved yet". Failed: `danger` `warning`, "Not saved. {reason}", and a press tries again.
   - **Cloud:** `cloud` in `accent-strong`, "Saved in openbeads cloud"; not signed in, `cloud-off` in `faint`, "Not in openbeads cloud: sign in to sync". The cloud icon is shown only once the app has cloud sync; until then the title line holds the local icon alone.
2. **`name:`** (`label` style, a 46px column) and the Project's name (Inter 600 16/24, one line, ellipsis) with a 24px **pencil**. The pencil turns the name into a TextField in place, with Save (check) and Cancel (×) beside it and a counter "n/40" in `meta` under it. Enter saves, Escape cancels, Save is disabled and the field gets the `danger` edge with "A Project needs a name." while empty. Rename is saved at once and is not part of Undo.
3. **`maker:`** and the maker's name (`control` 13/18, `body`), smaller than the project's name, with its own pencil, edited the same way (placeholder "Your name", counter "n/40", empty clears it). With no name the row reads "+ Add your name for exports" in `muted`. It is the old Name on exports row: per Project (ADR 0060), printed in Instrument Serif italic on PDF and PNG exports (printed-output.md).
4. **Technique:** a PanelPicker (Loom, Peyote, Brick stitch, Right-angle weave, Netting), the `pattern` icon. With brick stitch, **Brick block** follows as a row with a small Stepper (`picker-height`). The Canvas Technique row of ticket 0492 is gone: the Project has one Technique control. Locked once a Row progress pass is done (ticket 0492), with the reason in its Tooltip. With Netting, **Net size** follows the same way (ticket 0568). A switch to a Technique with a setting, or a Net size that would drop beads, asks first, and the question holds the setting (Brick block, Net size). Name, maker, Technique and the Bead section are the sections New Project shares (NewPatternForm card).

## Sections (PanelSection, in this order)

1. **bead:** Bead shape first, a small SegmentedControl on its row (Symmetric | Real). Then **Bead**: three PanelPicker buttons on the same row, Brand, Type, Size (`[Miyuki ⌄] [Delica ⌄] [11/0 ⌄]`, BeadPicker card). Collapsed summary: "Miyuki Delica 11/0 · real". No size or weight line.
2. **canvas:** the Canvas colors as 26px `radius-sm` swatches, 6px apart, the chosen one ringed `ink` with a 2px gap; the chosen color's name and hex at the right (`control` and `meta`). Five in light, five in dark, from the CanvasBackground card. In high contrast the swatches are replaced by one `body` line, "The canvas stays white in high contrast.". Collapsed summary: a 12px swatch and the name.
3. **export:** **Project file** (`export`, value `.openbeads`). Picture (PNG) and Printable chart (PDF) need a Frame and live in the Frame panel (Frame card).
4. **this project:** Duplicate, **Clear all beads** (`erase`, `danger`) and **Delete project** (`delete`, `danger`), as PanelItems. Clear all beads is the app's existing Clear: every bead of this canvas emptied and Row progress off, behind its usual confirmation, one Undo step; the Project stays.

Not here any more: the size estimate, Frame from starter and Beads needed (all in the Frame panel), the Save Project button (saving is automatic; the head shows its state) and the Canvas Technique.

## Duplicate and Delete

- Both close the panel, then open a dialog on the Modal shell (ConfirmDialogs card), `z-modal`. Neither is part of Undo and both act at once.
- **Duplicate:** "Duplicate Project", the note "Everything is copied, including Row progress, so the copy works as a snapshot.", a TextField "Name" holding the suggestion, its hint "Suggested: the current name and the next free number.", Cancel and a primary Duplicate. The suggestion is the name plus the first unused number from 2: "Moth" suggests "Moth 2", then "Moth 3" once that exists; a name that already ends in a number ("Moth 2") suggests the next free one ("Moth 3"). After confirming, the copy opens.
- **Delete project:** "Delete {name}?", "{name} and its Row progress are removed from this device. This can't be undone. Export it first if you want to keep a copy.", Cancel and a `danger`-filled "Delete Project". Afterwards the app shows the empty state with New Project and Import (EmptyCanvas card).

## Keyboard and screen readers

- Arrows move through the items and buttons; Tab leaves the panel; focus returns to the Project button. Escape first closes an open picker, then ends a rename or a maker's name edit, and only then closes the panel.
- The pencils are named for what they edit ("Rename Moth", "Change the maker's name"); each section is a named group; the save state is a polite live region, so "Not saved" is announced.

## Copy

English: project:, name:, maker:, Saved in local browser, Not saved yet, Saved in openbeads cloud, Not in openbeads cloud: sign in to sync, Add your name for exports, Technique, Brick block, Bead shape, Symmetric, Real, Bead, Project file, Duplicate, Clear all beads, Delete project. Russian: `writing.md` (Panels redesign).

Hand-written from spec 0440, the Menu and Project mockups and the ticket 0553 canvas; static rendition.
