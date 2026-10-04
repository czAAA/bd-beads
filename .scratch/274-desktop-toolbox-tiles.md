# 274: Desktop Toolbox: the v18 icon tiles

**What to build:** The Toolbox's Tools group matches the `ToolTabs` and `Toolbox` cards: six compact square tiles on the same 8-column grid as the Palette swatches (about 28px in the 264px Toolbox), not four bordered buttons per row. Today `Toolbox.vue` uses 4 columns, and `ToolButton.vue` has a 1px border, `radius-md` and an 18px icon, and prints a key badge (ticket 250) that the cards now also want, restyled. The tablet BottomToolbar and the phone tool sheet share `ToolButton`;  they change in ticket 275, so build the tile as a variant, not a rewrite. The last v18 export from claude.ai (copied in by ticket 273) has each tile centre its icon and print its key in the top-right corner. Source: the audit of design system v18 against the app (2026-10-04).

**Blocked by:** 273

**Human involvement:** autonomous

**Status:** ready-for-agent

- [ ] Desktop Toolbox tiles: 8-column grid, gap, square, `radius-sm`, `elevated` fill, no border, 16px icon in `muted`, as the card says (read it; don't restate values here)
- [ ] The active tile has an `ink` icon and an inset outline in `accent-strong` (card values for dark, high contrast and forced colors), not an accent icon and border
- [ ] Each tile centres its 16px icon (nothing else takes part in centring) and prints its key in the top-right corner as the `ToolTabs` card says (DM Mono 10px, `muted`, `ink` on the active tile and in high contrast, `aria-hidden`, positioned so it never moves the icon); the key is also in the Tooltip ("Paint (1)") and in `aria-keyshortcuts` (1, 2, 3, E, H, F), and it shows on every device, coarse pointers included
- [ ] Tool names stay as the app has them ("Eraser", ticket 250); the card is corrected in ticket 284
- [ ] Remove Frame always shows under the tiles, disabled while there is no Frame (today it is hidden with `v-if`)
- [ ] The Tools group keeps one Tab stop with arrow-key movement (ticket 159), and the Tooltips are not cut off (ticket 265)
- [ ] Unit tests for the changed components and the Toolbox's visual references regenerated deliberately for the new look; the card's `preview.html` matches what the app now draws, and the README Version changelog has a line
