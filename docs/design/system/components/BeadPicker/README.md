# BeadPicker

The one way to choose a Bead: New Project, Template setup and Replace Bead (ticket 535).

- **Collapsed** (the default): the Bead's name (`control`), one line below it in `meta` / `muted` saying what the Bead decides ("Sets size, weight and colors."), and a small `in-box` button "Change" with a chevron on the right. A person who does not care never opens it.
- **Opened** (the button now reads "Close", chevron up): three steps in a row that wraps on a phone, each a `label` (lowercase, `muted`) over an `in-box` menu button showing the current choice: **Brand**, **Form factor**, **Bead size**. Menus, not native selects (ticket 442); the chosen item has a check.
- Each step lists only what exists. Picking a Brand narrows the Form factors, picking a Form factor narrows the sizes. A step with one choice takes it. Nothing is picked until a whole Bead is known; until then the later step reads "Choose".
- **Replace Bead** (Project panel): the Bead's name stays in the "bead" row above, the picker is compact (hint and button only) and closes after a pick, which asks the confirmation. When the Project's own copy differs from the catalog's Bead, the size menu lists it first, disabled, with "(as saved)", and the catalog's Bead beside it.
- New Project and Template setup offer only the catalog's current Beads.

Hand-written from ticket 535; the Vue component `BeadPicker.vue` is the real thing.
