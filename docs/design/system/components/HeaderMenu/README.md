# HeaderMenu

The menu button next to the logo at every screen size and the menu it opens, built on the Menu card; it replaces the More menu (OverflowMenu, archived in v15).

- **Button:** the `menu` icon, right after the wordmark (after the mark on the phone), 10px gap. 34px ghost icon button from 744 (18px icon), 40px on the phone (20px icon). Hover `--hover-fill`, open `--press-fill`, focus the 2px `focus-ring` (3px in high contrast).
- **Phone (0–743):** Theme (opens the four-way theme sheet), Language, Name on exports, Keyboard shortcuts when a keyboard is attached; a rule; Overview, Take the tour, Source code. The imports stay in the Pattern sheet.
- **iPad mini (744–1023):** Import a file, Import QR code; a rule; Language, Theme, Name on exports; a rule; Overview, Take the tour, Source code.
- **1024 and up:** Overview, Take the tour and Source code only; the header's own controls stay where they are.
- **On /overview:** Overview, Take the tour and Source code at every size. They are navigation links: no check on the current page, only `aria-current="page"` on Overview.
- **Menu:** 4px under the button, left edges aligned, `canvas` / `panel`, 1px `panel-line` (`line-strong` in dark, 2px in high contrast), radius-md, `elevation-3`, padding 4, `z-popover`. Items 40px below 1024, 34px from 1024; 16px icons: `bead` for Overview, `info` for Take the tour, `code` for Source code, the More menu's icons for the rest; values right in `meta`. Rules in `line-soft`.
- **Motion:** `--duration-base` in, 150ms out, opacity and a 4px move; a fade only under reduced motion.
- **Keyboard and screen readers:** the button is "Menu" / «Меню» with `aria-haspopup="menu"` and `aria-expanded`; Enter, Space or Down opens on the first item, Up on the last; arrows, Home and End move; Enter chooses; Escape or Tab closes and returns focus to the button. `role="menu"`, items are links with `role="menuitem"`, `separator`.
- Take the tour starts step 1 (TourStep); Overview opens /overview; Source code opens the repository in a new tab (v18, ticket 269: the AGPL-3.0 network clause requires a hosted copy to link to its source), the only item that does.

Hand-written from the v15 sign-off.
