# Button

Every clickable action in bd-beads: primary, primary select, secondary, secondary in a box, text, link, icon, round icon and expand variants.

## When to use
- **Primary** (`bb-btn bb-btn--primary`): the single most likely next action in a region: New Pattern, Replace bead (as a select), Save Pattern, Row done. `accent` fill and border, `on-accent` text; hover and pressed use `accent-hover`; disabled uses `accent-disabled-bg` / `accent-disabled-fg`. **Two primary buttons never sit next to each other.**
- **Secondary** (`bb-btn`): on the page (header). `button` fill, `button-line` border, `ink` text; hover `surface` in light, `elevated` in dark.
- **Secondary in a box** (`bb-btn--in-box`): inside the save box and Saved Patterns: `elevated` fill, `line-strong` border (light) / `elevated` (dark). The Toolbox's own buttons (`bb-btn--toolbox`) use `panel-line` as border.
- **Text** (`bb-btn--text`): Import a file, Import QR code. No fill or border, padding 0 6, hover `surface`.
- **Link** (`bb-link`, `bb-link--danger`): Remove line (`ink`), Delete all (`danger`). 14/20 500, 16px icon, gap 6.
- **Icon** (`bb-btn--icon`, 34 × 34, radius-md) and **round icon** (`bb-btn--round`, radius-full): Turn row direction; Keyboard shortcuts.
- **Expand** (`bb-expand`): 28 × 28, 1px `line-strong`, radius-full, 14px arrow. Opens an expandable panel.
- **Danger fill** (`bb-btn--danger`): the confirm button of a destructive modal only.

## Anatomy
Height 34 (38 in the save box and Edit row, 32 in the Saved Patterns footer). Icon 15px, stroke 1.75, then the label (`control` role), 8px apart, padding 0 12, radius-md. Focus: 2px `accent` outline, 2px offset.

## What the consumer provides
The label (sentence case), an optional leading icon from the Icons group, and an accessible name for icon-only buttons.

Hand-written from DESIGN.md §5.1; static rendition.
