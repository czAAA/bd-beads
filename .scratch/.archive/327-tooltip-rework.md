# 327: Rework the Tooltip: name, body, key chip, disabled reason, light glass look

**What to build:** Rework `AppTooltip` so every control in the app can use it the same way (ADR 0035):
- **Props:** `name` (required), `body` (optional), `hotkey` (optional, shown as a key chip), `disabled` and `disabledBody`. The types make `disabledBody` required when `disabled` is set. When disabled, show the name and `disabledBody` (in `muted`), with no key chip.
- **Showing:** a control shows a Tooltip exactly when one is given to it, with no other condition.
- **Disabled controls:** use `aria-disabled="true"` instead of the native `disabled` attribute, so they stay hoverable and focusable and a click does nothing. Keep the `aria-label` on every control.
- **Look:** move from the dark `ink` bubble to a light, slightly see-through one: the `elevated` surface at about 90% opacity with a backdrop blur, `ink` text, a 1px `line-soft` border and the existing shadow token. Fully opaque in the High contrast theme. Text must pass WCAG 4.5:1 over any canvas color.
- **Keep:** the top-layer placement, edge handling and 15rem wrap (ticket 265), and the long-press on touch.

Change the design system in place: the Tooltip card README, tokens, `bundle.css`, `src/styles/design-values.css` and a changelog line (DESIGN.md §6). CONTEXT.md's Tooltip entry is already updated.

**Spec:** 343 (unified controls spec)

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `AppTooltip` takes `name`, `body?`, `hotkey?`, `disabled?` and `disabledBody`, and the type rejects `disabled` without `disabledBody`
- [x] A disabled control shows the name and `disabledBody`, with no key chip, on hover, focus and long-press
- [x] The new light look is in place in all four themes, opaque in High contrast, and contrast-checked
- [x] The design-system card, tokens, `bundle.css`, `design-values.css` and changelog are updated
- [x] Existing `AppTooltip` callers keep working, or are moved to the new props
