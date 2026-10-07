# Note

A thin block of helper text under a control or panel, always visible. It replaces every (i) button that had to be pressed to show its text. (Ticket 328.)

- **Shape:** a block on the `surface` fill, no border, no shadow, radius-sm, padding 8 10. As wide as what it sits under.
- **Text:** `meta`, in `muted`. No icon, no button, no close: the text is simply there. Long words break rather than overflow.
- **Used for:** the Estimated size warning in the Frame row ("This is an estimate: bead size × how many beads across and down. …") and the Beads needed explanation of the estimated weight ("This is bead count × about 0.0108 g per bead. …"). Both carry the text the (i) popups had.
- **Beads needed:** the Note sits under the table at every size, collapsed or expanded, outside the collapsed body's fixed height. It is shown only while the table has a weight to explain.
- Not for a warning that needs attention (that is a Message) and not for a hint that belongs to a hovered control (that is the Tooltip).

Hand-written; static rendition. Copy is the app's string in English and Russian.
