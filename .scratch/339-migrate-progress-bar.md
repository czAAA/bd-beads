# 339: Move the Progress bar to the shared controls

**What to build:** Rebuild the Progress bar: the Row progress switch (`P`), Set Frame, Turn row direction (`D`), and Row not done and Row done in their wide and compact forms. All of them show their key chips using the shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`, `Note`, `AppTooltip`) and the control registry (ADR 0035), with the copy from ticket 334. Delete the hand-written markup, labels, `title`s and key text it replaces. The migrations run one after another because they touch the same shell files.

**Spec:** 343 (unified controls spec)

**Blocked by:** 338

**Status:** needs-triage

- [ ] Every control in this area comes from a shared component and a registry action, with no per-place copy of its name, Tooltip or key
- [ ] Tooltips, key chips and disabled reasons match ticket 334's table
- [ ] No native `title` and no hand-built popup is left in this area
- [ ] The tests related to the changed files pass; update the visual baselines where the look changed on purpose
