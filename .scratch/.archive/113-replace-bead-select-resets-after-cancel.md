# 113: Replace Bead select goes back to its placeholder after Cancel

**What to build:** Cancelling the Replace Bead confirmation popup leaves the top-bar Bead select showing its "Replace bead…" placeholder, not the Bead the user just declined. Today the select keeps showing the declined Bead's name, so it reads as though that Bead were the current one. The same must hold after Confirm (the select shows the placeholder again, and the current Bead label above it shows the new Bead), and after picking the same Bead twice in a row (a second pick after Cancel must still open the popup).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] After Cancel in the Replace Bead popup, the select shows the placeholder, not a Bead name
- [ ] After Confirm, the select shows the placeholder and the Pattern's current Bead label shows the new Bead
- [ ] Picking the same Bead again after a Cancel opens the popup again
- [ ] A test covers the Cancel case (it fails before the fix)
