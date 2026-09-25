# 75: Apply design system to Toolbox & Tool groups

**What to build:** Restyle the Toolbox and its Tool groups per `DESIGN.md` (§3 tokens, §4.2 the Toolbox as the left column's first box, §5.4–5.7): Tools as tabs, Colors, Edit, and Mirror and Size as disclosure rows. Save, Export and the Row progress group leave the Toolbox (to the save box and the Progress bar, `DESIGN.md` §5.10–5.11); if those land in a separate ticket, this one keeps them in place until then.

**Blocked by:** 70 (done: `DESIGN.md`)

**Status:** ready-for-agent

- [ ] All existing Tool groups use the new design tokens (no hardcoded colors/spacing left from the old CSS)
- [ ] Behaviour follows `DESIGN.md`: the Toolbox scrolls with the left column rather than sticking, and Mirror and Size open in place below their row, closing on Escape
- [ ] Matches `DESIGN.md`'s Tool group template (§5.7) and `docs/design/light.png` / `dark.png`, in both themes
