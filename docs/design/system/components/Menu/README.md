# Menu

A popup list anchored under its button (Export ▾), and the Tooltip. (Derived in DESIGN.md.)

- **Menu:** 4px under its button, `canvas` / `panel` fill, radius-md, `elevation-3`, padding 4. Items 34px, radius-sm, icon + label; hover and focus use `surface` / `elevated`.
- **Export ▾** ends with the "name on exports" row (see NameOnExports): a `line-soft` rule, the name or "Not set", and Change or Add.
- **Tooltip** (ticket 327, ADR 0035; the Estimated size warning, every control's name): a light, slightly see-through bubble: `tooltip-fill` (`elevated` at 92% in light, 90% in dark, opaque in High contrast) over a backdrop blur (`tooltip-blur`, 8px, none in High contrast), `ink` text, a 1px `line-soft` border, `elevation-3`, radius-sm, padding 6 8, Inter 12/16, wrapping at 15rem. It says the **name** (700), an optional **key chip** beside it (DM Mono, `tooltip-muted`, 1px `line-strong` edge) and an optional **body** under them. A **disabled** control keeps its Tooltip: the name and its `disabledBody` in `tooltip-muted`, no key chip. `tooltip-muted` is `muted` (`body` in dark, so the text passes 4.5:1 over any canvas color the bubble lets through); contrast is checked in `src/styles/tooltip-contrast.test.ts`.

Hand-written from DESIGN.md §5.13; static rendition.
