# 70: Write DESIGN.md from the approved combined design

**What to build:** Step 2 of 2 after ticket 135. Write `DESIGN.md` at the repo root, committed, as the app's visual language and the reference tickets 75–77 implement against. Work from the variants the user approved in ticket 135 (one per theme) and the five source DESIGN.md files behind them (`node design-exploration/digest.mjs <company>` for clickhouse, hashicorp, mastercard, mistral.ai, warp). Document **only** the approved variants, for both light and dark themes. Ticket 135's "The design" section says which part comes from which source.

**Blocked by:** 135 (Combined design screenshots; the user must have approved them and recorded their pick)

**Status:** ready-for-agent

- [ ] `DESIGN.md` exists at the repo root and covers both themes: light (mistral.ai colors) and dark (clickhouse colors), plus how the theme toggle and the system default work
- [ ] Design tokens are documented with role names (e.g. `--accent`, `--surface`), not brand names: color per theme, spacing, radii, elevation, and typography (Inter / DM Mono / Instrument Serif and their roles, per warp)
- [ ] Visual and interaction templates exist for: Tool group, expandable panel (the fixed-height Beads needed / Saved Patterns boxes that grow downward), message/toast, popup/modal
- [ ] Layout is documented: header, Toolbox, canvas box with Progress bar, right-column stack (save box, Beads needed, Saved Patterns), background highlight, and bead drawing on the canvas
- [ ] No proprietary content: no company or product names, brand copy, logos or imagery; fonts per `design-exploration/fonts.md`; hex values, scales, radii and shadows kept exactly
- [ ] The reference is in a form tickets 75–77 can implement directly from
