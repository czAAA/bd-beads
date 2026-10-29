# ConfirmDialogs

The Delete all? and Replace bead? confirmations.

- The Modal template with the app's own copy: a destructive confirm is danger-filled (Delete all), any other is primary (Replace bead). Cancel is always on the left and has focus first.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

- **Duplicate Project** and **Delete {name}?** (spec 0440, ticket 0443; copy and fields in the ProjectPanel card). Duplicate is a primary confirm with a TextField "Name" (suggestion "Moth 2", counter, hint "Suggested: the current name and the next free number.") that has focus first with its text selected; Enter confirms, Cancel leaves everything as it was. Delete is danger-filled "Delete Project", names the Project in its title and body, and Cancel has focus first.
- **Replace bead? for a layer** (tickets 0665, 0670, ADR 0079): each layer has its own Bead, picked in its own Layer settings (LayerSettings card), so the dialog no longer asks which layer. For the Frame's, or the Canvas's without a Frame, the message is the Estimated size before and after; for the Canvas's under a Frame it says the Canvas is drawn at that bead's size and the Frame keeps its own bead.
- **Remove Frame?** (ticket 0489, ADR 0066): a destructive confirm (danger-filled "Remove Frame", Cancel on the left with focus first) whose message says the beads go too: "The Frame goes, and its beads go with it. Rows marked as done are cleared too. This can be undone." One Undo brings back the Frame, its beads and the marked rows. The Canvas under the Frame is never touched.
