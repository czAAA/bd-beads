# 337: Move the ContextBar to the shared controls

**What to build:** Rebuild the ContextBar: Fit to drawing, Remove Frame, Done, Copy, Rotate, Remove row/column, Clear selection and Cancel. These are the same registry actions as the Toolbox, so their Tooltips and keys match, and controls whose label hides on narrow widths keep their name in the Tooltip using the shared controls (`IconButton`, `AppButton`, `MenuButton`, `Swatch`, `Note`, `AppTooltip`) and the control registry (ADR 0035), with the copy from ticket 334. Delete the hand-written markup, labels, `title`s and key text it replaces. The migrations run one after another because they touch the same shell files.

**Spec:** 343 (unified controls spec)

**Blocked by:** 336

**Status:** done

- [x] Every control in this area comes from a shared component and a registry action, with no per-place copy of its name, Tooltip or key
- [x] Tooltips, key chips and disabled reasons match ticket 334's table
- [x] No native `title` and no hand-built popup is left in this area
- [x] The tests related to the changed files pass; update the visual baselines where the look changed on purpose

**Done:** every ContextBar button is a registry action through `IconButton`/`AppButton`; a button whose label has dropped swaps to the icon-only `IconButton` over the same action, so the Tooltip still names it. Added `done-frame`, `clear-selection` and `cancel-paste` to the registry. Remove line now reads its registry name, "Remove selected row/column", so it drops its label a step sooner on narrow widths. The bar passes the Project, so Rotate, Fit and Remove Frame take their disabled reasons from the registry; the Rotate-only `rotateOff` prop and its `rotateNeedsFrame` copy are gone. The three native-title exemptions are deleted.

**Left for a human:** visual baselines (not run here; CI's visual check will say if they moved), and a look at the bar on a phone in EN and RU. The `.context-bar__button` look is overridden on the ink bar with `:deep`; if you want an on-ink variant in the design system, that is a follow-up.
