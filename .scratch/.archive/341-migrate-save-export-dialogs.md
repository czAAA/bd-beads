# 341: Move the Save box, Saved Projects, dialogs and toasts to the shared controls

**What to build:** Rebuild the Save box (Save Project, Export menu, export prompt, Name on exports), Saved Projects, the Name on exports dialog, the confirm dialogs, toasts and messages. After this ticket, delete the old `ToolButton`, `ExpandButton` and `AppLink` components and every native `title` using the shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`, `Note`, `AppTooltip`) and the control registry (ADR 0035), with the copy from ticket 334. Delete the hand-written markup, labels, `title`s and key text it replaces. The migrations run one after another because they touch the same shell files.

**Spec:** 343 (unified controls spec)

**Blocked by:** None (340 merged in #109)

**Status:** ready-for-agent

- [ ] Every control in this area comes from a shared component and a registry action, with no per-place copy of its name, Tooltip or key
- [ ] Tooltips, key chips and disabled reasons match ticket 334's table
- [ ] No native `title` and no hand-built popup is left in this area
- [ ] The tests related to the changed files pass; update the visual baselines where the look changed on purpose
