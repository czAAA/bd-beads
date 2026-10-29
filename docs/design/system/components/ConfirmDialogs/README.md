# ConfirmDialogs

The Delete all? and Replace bead? confirmations.

- The Modal template with the app's own copy: a destructive confirm is danger-filled (Delete all), any other is primary (Replace bead). Cancel is always on the left and has focus first.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

- **Duplicate Project** and **Delete {name}?** (spec 0440, ticket 0443; copy and fields in the ProjectPanel card). Duplicate is a primary confirm with a TextField "Name" (suggestion "Moth 2", counter, hint "Suggested: the current name and the next free number.") that has focus first with its text selected; Enter confirms, Cancel leaves everything as it was. Delete is danger-filled "Delete Project", names the Project in its title and body, and Cancel has focus first.
- **Replace bead? with a Frame** (ticket 0665, ADR 0079): each layer has its own Bead, so above the message a small SegmentedControl labelled "Where to replace the bead" (`type-control`, `ink`, 6px over the control, 8px over the message) chooses Frame (first, chosen at each pick, as the Frame is the layer woven) or Canvas. With Frame the message is the Estimated size before and after; with Canvas it says the Canvas is drawn at that bead's size and the Frame keeps its own bead. Without a Frame there is no choice: the Canvas's Bead is replaced. Ticket 0670 moves the choice into Layer settings.
- **Remove Frame?** (ticket 0489, ADR 0066): a destructive confirm (danger-filled "Remove Frame", Cancel on the left with focus first) whose message says the beads go too: "The Frame goes, and its beads go with it. Rows marked as done are cleared too. This can be undone." One Undo brings back the Frame, its beads and the marked rows. The Canvas under the Frame is never touched.
