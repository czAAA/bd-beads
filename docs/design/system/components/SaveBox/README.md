# SaveBox

The second box of the left column: the library's save state, Save Pattern and the Export menu.

- Elevation 1 (`elevation-1`), padding 16 20.
- **Label row:** a 14px check in `accent` and "saved · this device" (`label`). When a save fails the icon becomes a `danger` warning and the text says so (Derived).
- **Buttons**, 38px, 8 apart: **Save Pattern** (primary, fills the row) and **Export ▾** (secondary in a box, trailing chevron) which opens a Menu with QR code, PNG image and PDF for printing.
- **Formats hint:** "qr · png · pdf" (`meta-small`), right-aligned under Export, 6px down.
- **Save Pattern saves the whole canvas (v16):** every piece and the Frame, so beads outside the Frame are kept and can be edited or exported later.
- **Export needs a Frame.** With none set, Export ▾ opens a popover in the Menu's place, under the button: "Set Frame to export" (`control`), "The Frame marks which beads become the Pattern. Beads outside it stay on the canvas." (13/18 `body`), then Fit to drawing (secondary) and Set Frame (primary, `frame` icon). 288px, padding 14, radius 10, `elevation-3`; `canvas` with a 1px `panel-line` border in light, `panel` with `line-strong` in dark.

Hand-written from DESIGN.md §5.10 and the v16 sign-off; static rendition.
