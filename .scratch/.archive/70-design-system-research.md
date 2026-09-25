# 70: Write DESIGN.md from the approved combined design

**What to build:** Step 2 of 2 after ticket 135. Write `DESIGN.md` at the repo root, committed, as the app's visual language and the reference tickets 75–77 implement against. Work from the screenshots the user approved in ticket 135 (light and dark) and the five source DESIGN.md files behind them (`node design-exploration/digest.mjs <company>` for clickhouse, hashicorp, mastercard, mistral.ai, warp). Document **only** the approved design, for both light and dark themes. Ticket 135's "The design" section says which part comes from which source.

**Blocked by:** 135 (Combined design screenshots; the user must have approved them)

**Status:** done

- [x] `DESIGN.md` exists at the repo root and covers both themes: light (mistral.ai colors) and dark (clickhouse colors), plus how the theme toggle and the system default work
- [x] Design tokens are documented with role names (e.g. `--accent`, `--surface`), not brand names: color per theme, spacing, radii, elevation, and typography (Inter / DM Mono / Instrument Serif and their roles, per warp)
- [x] Visual and interaction templates exist for: Tool group, expandable panel (the fixed-height Beads needed / Saved Patterns boxes that grow downward), message/toast, popup/modal
- [x] Layout is documented: header, the scrolling left column (Toolbox, save box, Beads needed, Saved Patterns as separate boxes), the canvas box filling the rest with its Progress bar (including the Show row progress switch), background highlight, and bead drawing on the canvas
- [x] No proprietary content: no company or product names, brand copy, logos or imagery; fonts per `design-exploration/fonts.md`; hex values, scales, radii and shadows kept exactly
- [x] The reference is in a form tickets 75–77 can implement directly from

**Done:** `DESIGN.md` (repo root), the approved screenshots in `docs/design/`, and [ADR 0021](../../docs/adr/0021-visual-language-follows-design-md.md) recording the decision, with amendment notes on ADRs 0004, 0005 and 0018. `CLAUDE.md` and `docs/agents/domain.md` point UI work at `DESIGN.md`. Message, modal, menu, focus/hover and Row progress off states are marked **Derived** there: they're not in the approved screenshots.
