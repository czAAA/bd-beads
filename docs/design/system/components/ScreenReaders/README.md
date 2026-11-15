# ScreenReaders

Landmarks, the accessible name of the Pattern, a name for every icon-only button, and what gets announced.

- Landmarks (ticket 0856): every page has exactly one `banner` and one `main`, and nothing outside a landmark but live regions and dialogs. In the editor the Canvas strip is the `header` (the banner) and the rest of the canvas box is the `main`: the drawing area, Convert image, the Progress bar and the bars over the drawing (the `main` draws no box of its own). On the Homepage the strip is the banner, the page of sections the `main`, and the section bar (the phone bar on a phone) a `nav` "Sections"; the demo inside it is a named region with no `main` of its own, its strip a plain `header` inside the Homepage's `main`. Panels are `dialog`s named by their title, except the Menu, a plain `region` whose rows are buttons (its subpanels are dialogs); a panel's header and footer are plain boxes, never `header` or `footer`, which in a dialog would be a second banner. Phone ToolSheets are `dialog`s named by their title.
- Headings (ticket 0995): the Homepage has one `h1`, the Welcome heading; each other section's title is an `h2` (Made by one family too, though it is drawn larger), and what sits under one an `h3`. In Convert image each section of the column (picture, bead and technique, Size, Colors) and the result at its foot is a region named as it is labelled. The look of a heading never follows its level.
- A control's name holds the text it shows (ticket 0856): a Tool tile's shortcut digit is a hint drawn on its chip, not text, and stays out of the name (`aria-keyshortcuts` gives the key); a stepper's number is named "{what it counts}: {number}"; a picker that shows a code names it after the label, then the value ("Language: EN, English"). The Homepage slogan is `role="img"` "openbeads", since a plain span may not carry a label.
- The Pattern is `role="img"` with a name that sums it up ("Logo panel, 40 by 30 beads, 2 colors, row 12 of 30 done"); Beads needed is its text equivalent.
- Icon-only buttons are named with the app's own words (Undo, Zoom in, Turn row direction, Back a row, More, Tools…); a swatch is "Color 1, red".
- Results are `role="status"` (polite): "Row 13 of 30", "Saved", "Patterns imported: 3". Errors are `role="alert"`. One announcement per action. Row done, Back a row and Go to row say the row in the counter's words, "Pattern done" after the last (ticket 0934).

Hand-written from the Phase C sign-off.

- **Menu and Project (spec 0440):** each section is a named group; each pencil is named for what it edits ("Rename Moth", "Edit Name on exports"); choice lists are `radiogroup`s with `aria-checked`; the save state is a polite live region, so a failed save is announced.
