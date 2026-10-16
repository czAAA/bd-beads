# ConfirmDialogs

The Delete all? and Replace bead? confirmations.

- The Modal template with the app's own copy: a destructive confirm is danger-filled (Delete all), any other is primary (Replace bead). Cancel is always on the left and has focus first.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.

- **Duplicate Project** and **Delete {name}?** (spec 0440, ticket 0443; copy and fields in the ProjectPanel card). Duplicate is a primary confirm with a TextField "Name" (suggestion "Moth 2", counter, hint "Suggested: the current name and the next free number.") that has focus first with its text selected; Enter confirms, Cancel leaves everything as it was. Delete is danger-filled "Delete Project", names the Project in its title and body, and Cancel has focus first.
