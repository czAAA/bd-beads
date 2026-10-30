# ConfirmDialogs

The Delete all? and Replace bead? confirmations.

- The Modal template with the app's own copy: a destructive confirm is danger-filled (Delete all), any other is primary (Replace bead). Cancel is always on the left and has focus first.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

- **Duplicate Project** and **Delete {name}?** (spec 0440, ticket 0443; copy and fields in the ProjectPanel card). Duplicate is a primary confirm with a TextField "Name" (suggestion "Moth 2", counter, hint "Suggested: the current name and the next free number.") that has focus first with its text selected; Enter confirms, Cancel leaves everything as it was. Delete is danger-filled "Delete Project", names the Project in its title and body, and Cancel has focus first.
- **Replace bead?** (tickets 0665, 0687; ADR 0079): each layer has its own Bead, picked in its own Layer settings (LayerSettings card): Project's canvas section the Canvas's, the Frame panel the Frame's. The dialog asks no layer. Its message names the layer and both Beads' sizes in mm, then says it looks different in proportion but the design and its bead count stay, and that it can be undone: "The Canvas's Bead changes from 1.5 × 1.5 mm to 1.7 × 2.2 mm. The Canvas will look different in proportion, but your design and its bead count stay exactly the same. You can undo this." The Frame's adds its Estimated size with the new Bead and the old, always in mm: "…, so the Frame will be about 16.5 × 44 mm instead of 15 × 30 mm. It will look different in proportion, …".
- **Open “{name}”?** (ticket 0716): picking a Project over the size gate asks first, a plain (not danger) confirm: "31 million beads. Opening may be slow or fail." (the count in whole millions from ten million, one decimal under it, cut down), **Open anyway** and Cancel.
- **Remove Frame?** (ticket 0489, ADR 0066): a destructive confirm (danger-filled "Remove Frame", Cancel on the left with focus first) whose message says the beads go too: "The Frame goes, and its beads go with it. Rows marked as done are cleared too. This can be undone." One Undo brings back the Frame, its beads and the marked rows. The Canvas under the Frame is never touched.
