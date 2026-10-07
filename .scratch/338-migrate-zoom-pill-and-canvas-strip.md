# 338: Move the Zoom pill, canvas strip and Canvas color to the shared controls

**What to build:** Rebuild the Zoom pill, the canvas strip and the Canvas color popover (Rulers, Undo, Redo, zoom out, zoom in, Fit, Canvas color and its Swatches). The Zoom pill's Progress bar toggle becomes the single Row progress action (`P`): turning it off turns Row progress off and hides the bar, and turning it on turns it on and shows the bar. There is no separate show/hide state any more (see the Zoom pill and Progress bar entries in CONTEXT.md) using the shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`, `Note`, `AppTooltip`) and the control registry (ADR 0035), with the copy from ticket 334. Delete the hand-written markup, labels, `title`s and key text it replaces. The migrations run one after another because they touch the same shell files.

**Spec:** 343 (unified controls spec)

**Blocked by:** 337

**Status:** needs-triage

- [ ] Every control in this area comes from a shared component and a registry action, with no per-place copy of its name, Tooltip or key
- [ ] Tooltips, key chips and disabled reasons match ticket 334's table
- [ ] No native `title` and no hand-built popup is left in this area
- [ ] The tests related to the changed files pass; update the visual baselines where the look changed on purpose
