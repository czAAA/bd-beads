# DisclosureRow

A full-width row for a rarely used Tool group (Mirror, Size) that opens its controls in place.

- Padding 10 0; 1px `panel-rule` above the first row and below every row.
- Icon (16), label (`control`), the current values right-aligned (`meta`, e.g. "↔ 1 · ↕ 0", "64×48 mm"), then a 16px chevron in `muted`.
- Clicking opens the group's controls **in place, below the row**, pushing what follows down; the chevron turns up. Escape closes the open row first.
- The consumer provides the icon, label, summary value and the opened content.

Hand-written from DESIGN.md §5.6; static rendition.
