# SavedPatterns

The fourth box of the left column: the five most recently saved Patterns as round thumbnails, expandable to all.

- Expandable panel (see BeadsNeeded): title "Saved Projects" (`library` icon), meta "5 of 12" (`meta-small`), Expand button. Collapsed body 104px.
- **Thumbnail grid:** 5 columns, row gap 12, column gap 4. Each cell: a 44px circle on `elevated` holding the Pattern's own 36px thumbnail, then 6px down its name (`small`, max 58px wide, one line, cut with an ellipsis) and size (`meta-tiny`, `muted`).
- **The open Pattern:** ring `0 0 0 2px panel, 0 0 0 4px accent`; its name in `accent`.
- **Remove:** a 20px round × (`panel` fill, 1px `line-strong`, icon 11) at the circle's top-right, shown on hover or keyboard focus.
- **Expanded footer:** 1px `line-soft` rule, 12px above and 14px inside: Export Pattern and Export all (secondary in a box, 32px, 13px text).
- The consumer provides the thumbnails; the preview's striped circles are placeholders.
- **No Frame (v16):** a saved canvas with no Frame shows "no Frame" where the size goes (`meta-tiny`, `muted`). Its thumbnail is drawn from every piece on the canvas; with a Frame, from the Frame.

Hand-written from DESIGN.md §5.8 and §5.9; static rendition.
