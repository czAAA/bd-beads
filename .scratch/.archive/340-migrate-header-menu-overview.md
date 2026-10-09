# 340: Move the header, Menu, shortcuts dialog and Overview to the shared controls

**What to build:** Rebuild the header (Menu, Keyboard shortcuts, Language switcher, Theme toggle, New Project, Import a file, Import QR code, the current Project summary), the header Menu, the Keyboard shortcuts dialog and the Overview page's controls using the shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`, `Note`, `AppTooltip`) and the control registry (ADR 0035), with the copy from ticket 334. Delete the hand-written markup, labels, `title`s and key text it replaces. The migrations run one after another because they touch the same shell files.

**Spec:** 343 (unified controls spec)

**Blocked by:** 339

**Status:** done

- [x] Every control in this area comes from a shared component and a registry action, with no per-place copy of its name, Tooltip or key
- [x] Tooltips, key chips and disabled reasons match ticket 334's table
- [x] No native `title` and no hand-built popup is left in this area
- [x] The tests related to the changed files pass; update the visual baselines where the look changed on purpose
