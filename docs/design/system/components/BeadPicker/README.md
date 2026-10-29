# BeadPicker

The one way to choose a Bead: New Project, Starter setup and Replace Bead (ticket 535).

- **Collapsed** (the default): the Bead's name (`control`), one line below it in `meta` / `muted` saying what the Bead decides ("Sets size, weight and colors."), and a small `in-box` button "Change" with a chevron on the right. A person who does not care never opens it.
- **Opened** (the button now reads "Close", chevron up): three steps in a row that wraps on a phone, each a `label` (lowercase, `muted`) over an `in-box` menu button showing the current choice: **Brand**, **Form factor**, **Bead size**. Menus, not native selects (ticket 442); the chosen item has a check.
- Each step lists only what exists. Picking a Brand narrows the Form factors, picking a Form factor narrows the sizes. A step with one choice takes it. Nothing is picked until a whole Bead is known; until then the later step reads "Choose".
- **Replace Bead** (each layer's panel, ticket 0687): when the layer's own copy differs from the catalog's Bead of its id, the size menu lists it first with "(as saved)", chosen, and the catalog's Bead beside it, which a pick replaces it with; the button shows the size alone and its name says "(as saved)".
- New Project and Starter setup offer only the catalog's current Beads.

**In the Project panel's canvas section and the Frame panel's bead section (tickets 0554, 0687):** no collapsed summary and no Change button: the row holds the three steps as PanelPicker buttons on one line, Brand, Type (the Form factor) and Size (`[Miyuki ⌄] [Delica ⌄] [11/0 ⌄]`), each opening its own menu; a pick asks the Replace Bead confirmation. A Brand or Type pick that leaves the size without a match picks the nearest size and says so in the confirmation. New Project and Starter setup keep the collapsed form.

Hand-written from ticket 535; the Vue component `BeadPicker.vue` is the real thing.
