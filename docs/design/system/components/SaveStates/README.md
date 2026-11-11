# SaveStates

Save failed, not saved and Saved.

- Save failed: the library-wide notice row under the header (Message, `danger` edge), the app's sentence and Export Pattern as the way out; the save box's label turns to the `danger` warning "not saved · this device".
- It stays until a save succeeds. While it stays, a reload or closing the tab asks first with the browser's own "Leave site?" question, since the latest change is only on screen (ticket 0858). Import and conversion errors stay beside the control that caused them (see Import results, New Pattern form).
- Saved: the Project panel's title line says it in words beside a check, "Saved in local browser"; a change not yet written reads "Not saved yet" (ProjectPanel card, ticket 0858). The strip's Project button shows the open Project's name, so which Project the state is about is always on screen (CanvasStrip card). Saving a Project file names its file in the one saved-file toast, "Saved: {file}" (Message card, ticket 0859).
- One icon, one meaning (ticket 0858): the floppy disk (`save`) is only ever the action of saving a Project file (the Save Project file row, the save ring). The saved state is a check (`check`), never the floppy.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
