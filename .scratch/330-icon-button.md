# 330: One IconButton for every icon-only control

**What to build:** Extend `IconButton` into the one icon-only control: `icon`, `size`, an optional `hotkey` and `showHotkey` (the small key badge, used by the tool buttons), `selected`, and an optional `tooltip` that is passed through to `AppTooltip` (ticket 327). It can take a registry action (ticket 329) and read its name, body, key, enabled state and `disabledBody` from it. It absorbs `ToolButton`, `ExpandButton`, the Dock slots, the sheet close ×, the zoom pill buttons and the width/height steppers as variants. The old components are deleted once the migrations (335–341) stop using them. Update the design-system card.

**Spec:** 343 (unified controls spec)

**Blocked by:** 327, 329

**Status:** needs-triage

- [ ] One `IconButton` covers the tool button (underline when selected, key badge), plain, box and round variants
- [ ] It takes a registry action or explicit props, with the Tooltip shown only when one is given
- [ ] Disabled uses `aria-disabled` and shows `disabledBody`
- [ ] Unit tests cover the variants, the Tooltip and the disabled state
