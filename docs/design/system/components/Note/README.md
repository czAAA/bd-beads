# Note

A thin block of helper text under a control or panel, always visible. It replaces every (i) button that had to be pressed to show its text. (Ticket 328.)

- **Shape:** a block on the `surface` fill, no border, no shadow, radius-sm, padding 8 10. As wide as what it sits under.
- **Text:** `meta`, in `muted`. No icon, no button, no close: the text is simply there. Long words break rather than overflow.
- **Used for:** text that must always be readable. The Estimated size warning and the Beads needed explanation of the estimated weight were Notes once; both are read once, so they are behind an Info button now (Button card; Beads needed's in its header, ticket 0852).
- Not for a warning that needs attention (that is a Message) and not for a hint that belongs to a hovered control (that is the Tooltip).

Hand-written; static rendition. Copy is the app's string in English and Russian.
